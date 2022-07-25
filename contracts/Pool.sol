// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";

import "./interfaces/IPool.sol";

contract Pool is Ownable, IPool {
  using TransferHelper for address;

  ISwapRouter public swapRouter;
  IQuoter public quoter;

  uint24 public fee;
  uint256 private _minInvest;

  struct PoolInfo {
    address entryAsset;
    address feeAddress;
    uint16 investFee;
    uint16 successFee;
    uint8 poolSize;
    uint8[] poolDistribution;
    address[] poolTokens;
  }

  PoolInfo public poolInfo;

  uint256[] public poolTokensBalances;
  uint256 public totalReceivedCurrency;
  uint256 public totalSuccessFee;
  uint256 public totalManagerFee;

  mapping(address => InvestmentData[]) private _investmentDataByUser;

  modifier validDistribution(uint8[] memory _poolDistribution) {
    uint8 res;
    for (uint256 i; i < _poolDistribution.length; i++) {
      res += _poolDistribution[i];
    }
    require(res == 100);
    _;
  }

  constructor(
    address _entryAsset,
    address _feeAddress,
    uint16 _investFee,
    uint16 _successFee,
    address _swapRouter,
    address _quoter,
    uint256 _min,
    uint24 _fee,
    address[] memory _poolTokens,
    uint8[] memory _poolDistribution
  ) validDistribution(_poolDistribution) {
    require(_poolTokens.length == _poolDistribution.length);

    poolInfo.entryAsset = _entryAsset;
    poolInfo.poolSize = uint8(_poolTokens.length);
    poolInfo.feeAddress = _feeAddress;
    poolInfo.investFee = _investFee;
    poolInfo.successFee = _successFee;
    fee = _fee;

    swapRouter = ISwapRouter(_swapRouter);
    quoter = IQuoter(_quoter);
    _minInvest = _min;

    for (uint256 i; i < _poolTokens.length; i++) {
      poolInfo.poolDistribution.push(_poolDistribution[i]);
      poolInfo.poolTokens.push(_poolTokens[i]);
      poolTokensBalances.push(0);
    }
  }

  function get() external view returns (uint8[] memory, address[] memory) {
    return (poolInfo.poolDistribution, poolInfo.poolTokens);
  }

  receive() external payable {
    require(msg.value >= _minInvest, "send matic");
    _initInvestment(msg.sender, msg.value, msg.value > 0);
  }

  function initSecureInvestment(
    address investor,
    uint256 amount,
    uint256[] memory outputs
  ) public {
    require(amount >= _minInvest, "amount is too small");

    PoolInfo memory _poolInfo = poolInfo;

    bool priceChanged = false;
    for (uint8 i = 0; i < _poolInfo.poolSize; i++) {
      uint256 inputAmountForToken = (amount * _poolInfo.poolDistribution[i]) /
        100;

      uint256 amountOfToken = _quote(
        _poolInfo.entryAsset,
        _poolInfo.poolTokens[i],
        inputAmountForToken
      );

      if (amountOfToken != outputs[i]) {
        priceChanged = true;
        break;
      }
    }
    require(priceChanged == false, "token price changed");

    _initInvestment(investor, amount, false);
  }

  function _initInvestment(
    address investor,
    uint256 amount,
    bool inputIsNativeToken
  ) private {
    // require(amount >= _minInvest, "amount is too small");

    PoolInfo memory _poolInfo = poolInfo;

    if (!inputIsNativeToken) {
      _poolInfo.entryAsset.safeTransferFrom(investor, address(this), amount);
    }

    uint256 managerFee = (amount * _poolInfo.investFee) / 100;
    uint256 investmentAmount = amount - managerFee;

    uint256[] memory tokenBalances = new uint256[](_poolInfo.poolSize);
    totalReceivedCurrency += investmentAmount;

    TransferHelper.safeApprove(
      _poolInfo.entryAsset,
      address(swapRouter),
      investmentAmount
    );

    uint256 timestamp = block.timestamp + 1200; // 20 mins

    for (uint256 i; i < _poolInfo.poolSize; i++) {
      uint256 amountForToken = (investmentAmount *
        _poolInfo.poolDistribution[i]) / 100;

      if (amountForToken == 0) {
        continue;
      }

      uint256 tokenBalance = _entryAssetToToken(
        _poolInfo.entryAsset,
        amountForToken,
        i,
        timestamp,
        inputIsNativeToken
      );

      tokenBalances[i] = tokenBalance;
    }

    _investmentDataByUser[investor].push(
      InvestmentData({
        inputIsNativeToken: inputIsNativeToken,
        receivedCurrency: investmentAmount,
        tokenBalances: tokenBalances,
        rebalanceEnabled: true,
        active: true
      })
    );

    if (managerFee > 0) {
      totalManagerFee += managerFee;

      if (inputIsNativeToken) {
        TransferHelper.safeTransferETH(_poolInfo.feeAddress, managerFee);
      } else {
        _poolInfo.entryAsset.safeTransferFrom(
          address(this),
          _poolInfo.feeAddress,
          managerFee
        );
      }
    }

    emit Invested(
      investor,
      investmentAmount,
      tokenBalances,
      _poolInfo.poolDistribution
    );
  }

  function withdraw(uint256 investmentId) public {
    // require(investmentId >= 0, "invalid investment Id");

    InvestmentData memory _investData = _investmentDataByUser[msg.sender][
      investmentId
    ];

    require(_investData.active, "Investment is not active");

    PoolInfo memory _poolInfo = poolInfo;

    uint256 entryAssetAmount;
    uint256 timestamp = block.timestamp + 1200; // 20 mins

    for (uint256 i; i < _poolInfo.poolSize; i++) {
      uint256 tokenBalance = _investData.tokenBalances[i];
      if (tokenBalance == 0) {
        continue;
      }

      uint256 amount = _tokensToEntryAsset(timestamp, tokenBalance, i);
      entryAssetAmount = entryAssetAmount + amount;
    }

    uint256 finalEntryAssetAmount = entryAssetAmount;
    uint256 receivedCurrency = _investData.receivedCurrency;

    if (entryAssetAmount > receivedCurrency) {
      uint256 successFee = (entryAssetAmount * _poolInfo.successFee) / 100;

      finalEntryAssetAmount = entryAssetAmount - successFee;

      totalSuccessFee += successFee;

      // TODO: If WMATIC - don't work (i think)
      _poolInfo.entryAsset.safeTransferFrom(
        address(this),
        _poolInfo.feeAddress,
        successFee
      );
    }

    _poolInfo.entryAsset.safeTransferFrom(
      address(this),
      msg.sender,
      finalEntryAssetAmount
    );

    _investmentDataByUser[msg.sender][investmentId].active = false;

    emit UnInvested(msg.sender, finalEntryAssetAmount, investmentId);
  }

  function rebalance(uint16 investmentId) public {
    // require(investmentId >= 0, "invalid investment Id");

    InvestmentData memory _investData = _investmentDataByUser[msg.sender][
      investmentId
    ];

    // TODO do deactivator for rebalance
    require(_investData.active, "Investment not active");
    require(_investData.rebalanceEnabled, "rebalance not enabled");

    PoolInfo memory _poolInfo = poolInfo;
    uint256 allSwappedCurrency;
    uint256 timestamp = block.timestamp + 1200; // 20 mins

    for (uint256 i; i < _poolInfo.poolSize; i++) {
      uint256 tokenBalance = _investData.tokenBalances[i];
      if (tokenBalance == 0) {
        continue;
      }

      _investmentDataByUser[msg.sender][investmentId].tokenBalances[i] = 0;
      uint256 amount = _tokensToEntryAsset(timestamp, tokenBalance, i);

      allSwappedCurrency += amount;
    }

    _poolInfo.entryAsset.safeApprove(address(swapRouter), allSwappedCurrency);

    uint256[] memory tokenBalances = new uint256[](_poolInfo.poolSize);
    for (uint256 i = 0; i < _poolInfo.poolSize; ++i) {
      uint256 amountForToken = (allSwappedCurrency *
        _poolInfo.poolDistribution[i]) / 100;

      if (amountForToken == 0) {
        continue;
      }

      uint256 tokenBalance = _entryAssetToToken(
        _poolInfo.entryAsset,
        amountForToken,
        i,
        timestamp,
        false
      );

      tokenBalances[i] = tokenBalance;

      // poolTokensBalances[i] = poolTokensBalances[i] + tokenBalance;
      _investData.tokenBalances[i] += tokenBalance;
    }

    _investmentDataByUser[msg.sender][investmentId] = _investData;

    emit Rebalanced(
      msg.sender,
      investmentId,
      _investData.tokenBalances,
      _poolInfo.poolDistribution
    );
  }

  function _quote(
    address tokenIn,
    address tokenOut,
    uint256 amount
  ) private returns (uint256) {
    return quoter.quoteExactInputSingle(tokenIn, tokenOut, fee, amount, 0);
  }

  function _swap(
    address tokenIn,
    address tokenOut,
    uint256 timestamp,
    uint256 amount,
    bool inputIsNativeToken
  ) private returns (uint256) {
    ISwapRouter.ExactInputSingleParams memory paramsForSwap = ISwapRouter
      .ExactInputSingleParams({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: fee,
        recipient: address(this),
        deadline: timestamp,
        amountIn: amount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      });

    if (inputIsNativeToken) {
      return swapRouter.exactInputSingle{ value: amount }(paramsForSwap);
    }

    return swapRouter.exactInputSingle(paramsForSwap);
  }

  function _entryAssetToToken(
    address entryAssetAddress,
    uint256 amount,
    uint256 i,
    uint256 timestamp,
    bool inputIsNativeToken
  ) private returns (uint256 tokenBalance) {
    tokenBalance = _swap(
      entryAssetAddress,
      poolInfo.poolTokens[i],
      timestamp,
      amount,
      inputIsNativeToken
    );

    poolTokensBalances[i] += tokenBalance;
  }

  // TODO do eth withdraw too (in my tests)
  function _tokensToEntryAsset(
    uint256 timestamp,
    uint256 tokenBalance,
    uint256 i
  ) private returns (uint256 outputAmountFromToken) {
    PoolInfo memory _poolInfo = poolInfo;

    TransferHelper.safeApprove(
      _poolInfo.poolTokens[i],
      address(swapRouter),
      tokenBalance
    );

    outputAmountFromToken = _swap(
      _poolInfo.poolTokens[i],
      _poolInfo.entryAsset,
      timestamp,
      tokenBalance,
      false
    );

    poolTokensBalances[i] -= tokenBalance;
  }
}
