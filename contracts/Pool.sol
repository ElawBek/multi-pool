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
    address quoter_,
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
    _quoter = IQuoter(quoter_);
    _minInvest = _min;

    for (uint256 i; i < _poolTokens.length; i++) {
      poolInfo.poolDistribution.push(_poolDistribution[i]);
      poolInfo.poolTokens.push(_poolTokens[i]);
      _poolTokensBalances.push(0);
    }
  }

  receive() external payable nonReentrant whenNotPaused {
    require(msg.value >= _minInvest, "amount is too small");
    _initInvestment(msg.sender, msg.value, msg.value > 0);
  }

  function invest(uint256 amount, uint256[] memory outputs)
    external
    payable
    whenNotPaused
    nonReentrant
  {
    require(amount >= _minInvest, "amount is too small");

    if (msg.value > 0) {
      require(msg.value == amount, "wrong value");
    }

    // PoolInfo memory _poolInfo = poolInfo;

    // bool priceChanged = false;
    // for (uint256 i = 0; i < _poolInfo.poolSize; i++) {
    //   uint256 inputAmountForToken = (amount * _poolInfo.poolDistribution[i]) /
    //     100;

    //   uint256 amountOfToken = _quote(
    //     _poolInfo.entryAsset,
    //     _poolInfo.poolTokens[i],
    //     inputAmountForToken
    //   );

    //   if (amountOfToken != outputs[i]) {
    //     priceChanged = true;
    //     break;
    //   }
    // }
    // require(priceChanged == false, "token price changed");

    _initInvestment(msg.sender, amount, msg.value > 0);
  }

  function withdraw(uint256 investmentId) external nonReentrant whenNotPaused {
    uint256 investCount = _investmentIds[msg.sender];
    require(
      investmentId <= investCount && investCount > 0,
      "Invesment non-exists"
    );

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

      TransferHelper.safeTransferFrom(
        _poolInfo.entryAsset,
        address(this),
        _poolInfo.feeAddress,
        successFee
      );
    }

    TransferHelper.safeTransferFrom(
      _poolInfo.entryAsset,
      address(this),
      msg.sender,
      finalEntryAssetAmount
    );

    _investmentDataByUser[msg.sender][investmentId].active = false;

    emit UnInvested(msg.sender, finalEntryAssetAmount, investmentId);
  }

  function toggleRebalance(uint256 investmentId) external whenNotPaused {
    uint256 investCount = _investmentIds[msg.sender];
    require(
      investmentId <= investCount && investCount > 0,
      "Invesment non-exists"
    );

    InvestmentData memory _investData = _investmentDataByUser[msg.sender][
      investmentId
    ];

    require(_investData.active, "Investment not active");

    _investmentDataByUser[msg.sender][investmentId]
      .rebalanceEnabled = !_investData.rebalanceEnabled;

    // TODO event
  }

  function rebalance(uint256 investmentId) external nonReentrant whenNotPaused {
    uint256 investCount = _investmentIds[msg.sender];
    require(
      investmentId <= investCount && investCount > 0,
      "Invesment non-exists"
    );

    InvestmentData memory _investData = _investmentDataByUser[msg.sender][
      investmentId
    ];

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

      // _investmentDataByUser[msg.sender][investmentId].tokenBalances[i] = 0;
      uint256 amount = _tokensToEntryAsset(timestamp, tokenBalance, i);

      allSwappedCurrency += amount;
    }

    TransferHelper.safeApprove(
      _poolInfo.entryAsset,
      address(_swapRouter),
      allSwappedCurrency
    );

    // uint256[] memory tokenBalances = new uint256[](_poolInfo.poolSize);
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

      // tokenBalances[i] = tokenBalance;

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
