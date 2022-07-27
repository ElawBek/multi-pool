// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";

import "./interfaces/IExchange.sol";
import "./interfaces/IPool.sol";

contract PoolStorage is Ownable, IPool, Pausable, ReentrancyGuard {
  IExchange internal _swapRouter;
  address internal _wrapOfNativeToken;

  uint256 internal _minInvest;

  PoolInfo public poolInfo;

  uint256[] internal _poolTokensBalances;
  uint256 public totalReceivedCurrency;
  uint256 public totalInvestFee;
  uint256 public totalSuccessFee;

  mapping(address => InvestmentData[]) internal _investmentDataByUser;
  mapping(address => uint256) internal _investmentIds;

  modifier validDistribution(uint8[] memory _poolDistribution) {
    uint8 res;
    for (uint256 i; i < _poolDistribution.length; i++) {
      res += _poolDistribution[i];
    }
    require(res == 100);
    _;
  }

  function swapRouter() external view returns (address) {
    return address(_swapRouter);
  }

  function poolTokensBalances() external view returns (uint256[] memory) {
    return _poolTokensBalances;
  }

  function investmentByUser(address investor, uint256 investmentId)
    public
    view
    virtual
    returns (InvestmentData memory)
  {
    return _investmentDataByUser[investor][investmentId];
  }

  function investmentsByUser(address investor)
    public
    view
    virtual
    returns (InvestmentData[] memory)
  {
    return _investmentDataByUser[investor];
  }

  function entryAsset() external view returns (address) {
    return poolInfo.entryAsset;
  }

  function tokenList() external view returns (address[] memory) {
    return poolInfo.poolTokens;
  }

  function poolTokensDistributions() external view returns (uint8[] memory) {
    return poolInfo.poolDistribution;
  }

  function poolData() external view returns (PoolData memory) {
    PoolData memory _poolData = PoolData({
      owner: owner(),
      entryAsset: poolInfo.entryAsset,
      poolTokens: poolInfo.poolTokens,
      poolDistribution: poolInfo.poolDistribution,
      poolTokensBalances: _poolTokensBalances,
      poolSize: poolInfo.poolSize,
      feeAddress: poolInfo.feeAddress,
      investFee: poolInfo.investFee,
      successFee: poolInfo.successFee,
      totalReceivedCurrency: totalReceivedCurrency,
      totalInvestFee: totalInvestFee,
      totalSuccessFee: totalSuccessFee
    });

    return _poolData;
  }

  function pause() public onlyOwner {
    _pause();
  }

  function unpause() public onlyOwner {
    _unpause();
  }

  function setFeeAddress(address _feeAddress) external onlyOwner whenPaused {
    require(poolInfo.feeAddress != _feeAddress, "this address is already set");
    require(_feeAddress != address(0), "new fee address is address(0)");

    poolInfo.feeAddress = _feeAddress;
  }

  function setMinInvestmentLimit(uint256 _minInvestmentLimit)
    external
    onlyOwner
    whenPaused
  {
    require(_minInvestmentLimit > 0, "new min invest is zero");
    _minInvest = _minInvestmentLimit;
  }

  /// @dev only uniswapV3 method!
  function setFee(uint24 newFee) external onlyOwner whenPaused {
    _swapRouter.setFee(newFee);
  }

  function setPoolTokensDistributions(uint8[] memory poolDistributions)
    external
    onlyOwner
    whenPaused
    validDistribution(poolDistributions)
  {
    poolInfo.poolDistribution = poolDistributions;
  }

  function _initInvestment(
    address investor,
    uint256 amount,
    bool inputIsNativeToken
  ) internal {
    PoolInfo memory _poolInfo = poolInfo;

    if (!inputIsNativeToken) {
      TransferHelper.safeTransferFrom(
        _poolInfo.entryAsset,
        investor,
        address(this),
        amount
      );
    }

    uint256 managerFee = (amount * _poolInfo.investFee) / 100;
    uint256 investmentAmount = amount - managerFee;
    totalReceivedCurrency += investmentAmount;

    uint256[] memory tokenBalances = new uint256[](_poolInfo.poolSize);

    if (!inputIsNativeToken) {
      TransferHelper.safeApprove(
        _poolInfo.entryAsset,
        address(_swapRouter),
        investmentAmount
      );
    }

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
    _investmentIds[investor]++;

    if (managerFee > 0) {
      totalInvestFee += managerFee;

      if (inputIsNativeToken) {
        TransferHelper.safeTransferETH(_poolInfo.feeAddress, managerFee);
      } else {
        TransferHelper.safeTransferFrom(
          _poolInfo.entryAsset,
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

  function _entryAssetToToken(
    address entryAssetAddress,
    uint256 amount,
    uint256 i,
    uint256 timestamp,
    bool inputIsNativeToken
  ) internal returns (uint256) {
    uint256 tokenBalance;
    if (inputIsNativeToken) {
      tokenBalance = _swapRouter.swap{ value: amount }(
        entryAssetAddress,
        poolInfo.poolTokens[i],
        timestamp,
        amount,
        address(this),
        inputIsNativeToken
      );
      _poolTokensBalances[i] += tokenBalance;

      return tokenBalance;
    }

    TransferHelper.safeTransfer(
      entryAssetAddress,
      address(_swapRouter),
      amount
    );

    tokenBalance = _swapRouter.swap(
      entryAssetAddress,
      poolInfo.poolTokens[i],
      timestamp,
      amount,
      address(this),
      inputIsNativeToken
    );
    _poolTokensBalances[i] += tokenBalance;

    return tokenBalance;
  }

  function _tokensToEntryAsset(
    uint256 timestamp,
    uint256 tokenBalance,
    uint256 i
  ) internal returns (uint256 outputAmountFromToken) {
    PoolInfo memory _poolInfo = poolInfo;

    TransferHelper.safeTransfer(
      _poolInfo.poolTokens[i],
      address(_swapRouter),
      tokenBalance
    );

    outputAmountFromToken = _swapRouter.swap(
      _poolInfo.poolTokens[i],
      _poolInfo.entryAsset,
      timestamp,
      tokenBalance,
      address(this),
      false
    );

    _poolTokensBalances[i] -= tokenBalance;
  }
}
