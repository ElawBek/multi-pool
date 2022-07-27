// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "./interfaces/IExchange.sol";
import "./interfaces/IPool.sol";

import "./PoolStorage.sol";

contract Pool is PoolStorage {
  constructor(
    address _entryAsset,
    address _feeAddress,
    uint16 _investFee,
    uint16 _successFee,
    address swapRouter_,
    address wrapOfNativeToken_,
    uint256 _min,
    address[] memory _poolTokens,
    uint8[] memory _poolDistribution
  ) validDistribution(_poolDistribution) {
    require(_poolTokens.length == _poolDistribution.length);

    poolInfo.entryAsset = _entryAsset;
    poolInfo.poolSize = uint8(_poolTokens.length);
    poolInfo.feeAddress = _feeAddress;
    poolInfo.investFee = _investFee;
    poolInfo.successFee = _successFee;

    _swapRouter = IExchange(swapRouter_);
    _wrapOfNativeToken = wrapOfNativeToken_;
    _minInvest = _min;

    for (uint256 i; i < _poolTokens.length; i++) {
      poolInfo.poolDistribution.push(_poolDistribution[i]);
      poolInfo.poolTokens.push(_poolTokens[i]);
      _poolTokensBalances.push(0);
    }
  }

  receive() external payable nonReentrant whenNotPaused {
    require(_wrapOfNativeToken != address(0), "entry asset not native token");
    require(msg.value >= _minInvest, "amount is too small");
    _initInvestment(msg.sender, msg.value, msg.value > 0);
  }

  function invest(uint256 amount) external payable whenNotPaused nonReentrant {
    require(amount >= _minInvest, "amount is too small");

    if (_wrapOfNativeToken != address(0)) {
      require(msg.value == amount, "wrong value");
    }

    _initInvestment(msg.sender, amount, msg.value > 0);
  }

  function previewDeposit(uint256 amountIn)
    external
    returns (uint256[] memory previewBalances)
  {
    PoolInfo memory _poolInfo = poolInfo;
    IExchange swapRouter_ = _swapRouter;

    previewBalances = new uint256[](_poolInfo.poolSize);
    for (uint256 i; i < _poolInfo.poolSize; i++) {
      uint256 amountForToken = (amountIn * _poolInfo.poolDistribution[i]) / 100;

      if (amountForToken == 0) {
        continue;
      }

      previewBalances[i] = swapRouter_.quote(
        _poolInfo.entryAsset,
        _poolInfo.poolTokens[i],
        amountForToken
      );
    }
  }

  function withdraw(uint256 investmentId) external nonReentrant whenNotPaused {
    uint256 investCount = _investmentIds[msg.sender];
    require(
      investmentId <= investCount && investCount > 0,
      "investment non-exists"
    );

    InvestmentData memory _investData = _investmentDataByUser[msg.sender][
      investmentId
    ];

    require(_investData.active, "investment not active");

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

    if (entryAssetAmount > _investData.receivedCurrency) {
      uint256 successFee = (entryAssetAmount * _poolInfo.successFee) / 100;

      finalEntryAssetAmount = entryAssetAmount - successFee;

      totalSuccessFee += successFee;

      TransferHelper.safeTransferFrom(
        poolInfo.entryAsset,
        address(this),
        _poolInfo.feeAddress,
        successFee
      );
    }

    TransferHelper.safeTransferFrom(
      poolInfo.entryAsset,
      address(this),
      msg.sender,
      finalEntryAssetAmount
    );

    _investmentDataByUser[msg.sender][investmentId].active = false;

    emit InvestmentWithdrawal(msg.sender, finalEntryAssetAmount, investmentId);
  }

  function toggleRebalance(uint256 investmentId) external whenNotPaused {
    uint256 investCount = _investmentIds[msg.sender];
    require(
      investmentId <= investCount && investCount > 0,
      "investment non-exists"
    );

    InvestmentData memory _investData = _investmentDataByUser[msg.sender][
      investmentId
    ];

    require(_investData.active, "investment not active");

    _investmentDataByUser[msg.sender][investmentId]
      .rebalanceEnabled = !_investData.rebalanceEnabled;

    emit ToggleRebalance(
      msg.sender,
      investmentId,
      !_investData.rebalanceEnabled
    );
  }

  function rebalance(uint256 investmentId) external nonReentrant whenNotPaused {
    uint256 investCount = _investmentIds[msg.sender];
    require(
      investmentId <= investCount && investCount > 0,
      "investment non-exists"
    );

    InvestmentData memory _investData = _investmentDataByUser[msg.sender][
      investmentId
    ];

    require(_investData.active, "investment not active");
    require(_investData.rebalanceEnabled, "rebalance not enabled");

    PoolInfo memory _poolInfo = poolInfo;
    uint256 allSwappedCurrency;
    uint256 timestamp = block.timestamp + 1200; // 20 mins

    for (uint256 i; i < _poolInfo.poolSize; i++) {
      uint256 tokenBalance = _investData.tokenBalances[i];
      if (tokenBalance == 0) {
        continue;
      }

      uint256 amount = _tokensToEntryAsset(timestamp, tokenBalance, i);

      allSwappedCurrency += amount;
    }

    TransferHelper.safeApprove(
      _poolInfo.entryAsset,
      address(_swapRouter),
      allSwappedCurrency
    );

    for (uint256 i = 0; i < _poolInfo.poolSize; ++i) {
      uint256 amountForToken = (allSwappedCurrency *
        _poolInfo.poolDistribution[i]) / 100;

      if (amountForToken == 0) {
        _investData.tokenBalances[i] = 0;
        continue;
      }

      uint256 tokenBalance = _entryAssetToToken(
        _poolInfo.entryAsset,
        amountForToken,
        i,
        timestamp,
        false
      );

      _investData.tokenBalances[i] = tokenBalance;
    }

    _investmentDataByUser[msg.sender][investmentId]
      .receivedCurrency = allSwappedCurrency;

    _investmentDataByUser[msg.sender][investmentId].tokenBalances = _investData
      .tokenBalances;

    emit Rebalanced(
      msg.sender,
      investmentId,
      _investData.tokenBalances,
      _poolInfo.poolDistribution
    );
  }
}
