// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "./interfaces/IExchange.sol";
import "./interfaces/IPool.sol";

import "./PoolStorage.sol";

/// @title Pool
contract Pool is PoolStorage {
  /**
   * Constructor.
   * @param _entryAsset main application asset.
   * @param _feeAddress address for collecting application fees.
   * @param _investFee the fee charged for each investment.
   * @param _successFee the fee charged for the successful generation of profit from the application.
   * @param swapRouter_ wrapper over the router exchange.
   * @param wrapOfNativeToken_ address to check if entryAsset is a native blockchain token or not.
   * @param _min the minimum possible amount of tokens for investment.
   * @param _name the name of the token pool (e.g. TokenName-pool).
   * @param _fees - fee of each pool. (If pancake - empty array)
   * @param _poolTokens the addresses of the tokens to which the entryAsset will be exchanged.
   * @param _poolDistribution Asset allocation. The percentage of the pool's asset allocation.

   * @dev if entryAsset will be a native blockchain token - `_entryAsset` must be a wrapped token of it.
   * `_investFee` charged in entryAsset tokens (if entryAsset is the native blockchain token - fee will be in that).
   * `_investFee` & `_successFee` are calculated as hundredths of the amount of tokens.
   * if `wrapOfNativeToken_` is address(0) - entry asset is not a native token.
   * sum of all distributions must be equal 100.
   */
  constructor(
    address _entryAsset,
    address _feeAddress,
    uint8 _investFee,
    uint8 _successFee,
    address swapRouter_,
    address wrapOfNativeToken_,
    uint256 _min,
    string memory _name,
    uint24[] memory _fees,
    address[] memory _poolTokens,
    uint8[] memory _poolDistribution
  )
    PoolStorage(swapRouter_, wrapOfNativeToken_)
    validDistribution(_poolDistribution)
  {
    require(_poolTokens.length == _poolDistribution.length);
    require(_min > 0, "new minInvest is 0");
    require(_investFee <= 50, "new invest fee is too big");
    require(_successFee <= 50, "new success fee is too big");

    poolInfo.entryAsset = _entryAsset;
    poolInfo.poolSize = uint8(_poolTokens.length);
    poolInfo.feeAddress = _feeAddress;
    poolInfo.investFee = _investFee;
    poolInfo.successFee = _successFee;

    // an array must be not empty only when router - uniswap
    if (_fees.length != 0) {
      fees = _fees;
    }

    name = _name;
    _minInvest = _min;

    // the amount of gas consumption is less due to the removal of the overflow check
    unchecked {
      for (uint256 i; i < _poolTokens.length; i++) {
        poolInfo.poolDistribution.push(_poolDistribution[i]);
        poolInfo.poolTokens.push(_poolTokens[i]);
        _poolTokensBalances.push(0);
      }
    }
  }

  /// @notice returns address of the swapRouter
  function swapRouter() external view returns (address) {
    return address(_swapRouter);
  }

  /// @notice returns current swapped tokens balances.
  function poolTokensBalances() external view returns (uint256[] memory) {
    return _poolTokensBalances;
  }

  /// @notice returns investment by user address and array index.
  /// @dev revets with not exists investments
  function investmentByUser(address investor, uint256 investmentId)
    external
    view
    virtual
    returns (InvestmentData memory)
  {
    return _investmentDataByUser[investor][investmentId];
  }

  /// @notice returns all investments by user address.
  function investmentsByUser(address investor)
    external
    view
    virtual
    returns (InvestmentData[] memory)
  {
    return _investmentDataByUser[investor];
  }

  /// @notice returns address of entry asset.
  function entryAsset() external view returns (address) {
    return poolInfo.entryAsset;
  }

  /// @notice returns the addresses of the tokens.
  function tokenList() external view returns (address[] memory) {
    return poolInfo.poolTokens;
  }

  /// @notice returns the ssset allocation.
  function poolTokensDistributions() external view returns (uint8[] memory) {
    return poolInfo.poolDistribution;
  }

  /// @notice returns poolData.
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

  /**
   * @notice sending assets in a native blockchain token will trigger the investment function.
   * taking the sent currency for the investment amount.
   *
   * @dev reverts when _wrapOfNativeToken is address(0).
   * @dev reverts when the amount of token to be sent is less than the minimum possible investment.
   * @dev reverts when the application is paused
   * @dev emits the `Invested` event.
   */
  receive() external payable nonReentrant whenNotPaused {
    require(_wrapOfNativeToken != address(0), "entry asset not native token");
    require(msg.value >= _minInvest, "amount is too small");
    _initInvestment(msg.sender, msg.value, msg.value > 0);
  }

  /**
   * @notice function to initialize the investment.
   * @param amount - amount of tokens for investment.
   *
   * @dev reverts when the amount of token to be sent is less than the minimum possible investment.
   * @dev reverts when the application is paused.
   * @dev if _wrapOfNativeToken is not address(0) - msg.value must be equal param `amount`.
   * @dev emits the `Invested` event.
   */
  function invest(uint256 amount) external payable whenNotPaused nonReentrant {
    require(amount >= _minInvest, "amount is too small");

    if (_wrapOfNativeToken != address(0)) {
      require(msg.value == amount, "wrong value");
    }

    _initInvestment(msg.sender, amount, msg.value > 0);
  }

  /**
   * @notice function to withdraw the investment.
   * @param investmentId - index of investment, given by user.
   *
   * @dev reverts when investmentId is not exist yet.
   * @dev reverts when investment not active.
   * @dev emits the `InvestmentWithdrawal` event.
   */
  function withdraw(uint256 investmentId) external nonReentrant {
    uint256 investCount = investmentIds[msg.sender];
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
    uint256 timestamp;
    unchecked {
      // overflow is not possible
      timestamp = block.timestamp + 1200; // 20 mins
      totalReceivedCurrency -= _investData.receivedCurrency;
    }
    uint24[] memory _fees = fees;

    for (uint256 i; i < _poolInfo.poolSize; i++) {
      uint256 tokenBalance = _investData.tokenBalances[i];
      if (tokenBalance == 0) {
        continue;
      }

      uint256 amount = _tokensToEntryAsset(
        timestamp,
        tokenBalance,
        i,
        _fees.length == 0 ? 0 : _fees[0]
      );
      unchecked {
        // overflow is not possible
        entryAssetAmount += amount;
      }
    }

    uint256 finalEntryAssetAmount = entryAssetAmount;
    if (entryAssetAmount > _investData.receivedCurrency) {
      uint256 successFee = (entryAssetAmount * _poolInfo.successFee) / 100;

      unchecked {
        // overflow is not possible
        finalEntryAssetAmount = entryAssetAmount - successFee;
        totalSuccessFee += successFee;
      }

      TransferHelper.safeTransfer(
        poolInfo.entryAsset,
        _poolInfo.feeAddress,
        successFee
      );
    }

    TransferHelper.safeTransfer(
      poolInfo.entryAsset,
      msg.sender,
      finalEntryAssetAmount
    );

    _investmentDataByUser[msg.sender][investmentId].active = false;

    emit InvestmentWithdrawal(msg.sender, finalEntryAssetAmount, investmentId);
  }

  /**
   * @notice function to toggle rebalanceEnabled flag in the investment.
   * @param investmentId - index of investment, given by user.
   *
   * @dev reverts when investmentId is not exist yet.
   * @dev reverts when investment not active.
   * @dev reverts when the pool is on pause.
   * @dev emits the `ToggleRebalance` event.
   */
  function toggleRebalance(uint256 investmentId) external whenNotPaused {
    uint256 investCount = investmentIds[msg.sender];
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

  /**
   * @notice function to rebalance the investment.
   * @param investmentId - index of investment, given by user.
   *
   * @dev reverts when investmentId is not exist yet.
   * @dev reverts when investment not active.
   * @dev reverts when rebalance is not enabled.
   * @dev reverts when the pool is on pause.
   * @dev emits the `Rebalanced` event.
   */
  function rebalance(uint256 investmentId) external nonReentrant whenNotPaused {
    uint256 investCount = investmentIds[msg.sender];
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
    uint256 timestamp;
    unchecked {
      // overflow is not possible

      timestamp = block.timestamp + 1200; // 20 mins
      totalReceivedCurrency -= _investData.receivedCurrency;
    }

    uint24[] memory _fees = fees;

    for (uint256 i; i < _poolInfo.poolSize; i++) {
      uint256 tokenBalance = _investData.tokenBalances[i];
      if (tokenBalance == 0) {
        continue;
      }
      uint256 amount = _tokensToEntryAsset(
        timestamp,
        tokenBalance,
        i,
        _fees.length == 0 ? 0 : _fees[0]
      );

      unchecked {
        // overflow is not possible
        allSwappedCurrency += amount;
      }
    }

    TransferHelper.safeApprove(
      _poolInfo.entryAsset,
      address(_swapRouter),
      allSwappedCurrency
    );

    for (uint256 i = 0; i < _poolInfo.poolSize; i++) {
      uint256 amountForToken;
      unchecked {
        // overflow is not possible
        amountForToken =
          (allSwappedCurrency * _poolInfo.poolDistribution[i]) /
          100;
      }

      if (amountForToken == 0) {
        _investData.tokenBalances[i] = 0;
        continue;
      }
      uint256 tokenBalance = _entryAssetToToken(
        _poolInfo.entryAsset,
        amountForToken,
        i,
        _fees.length == 0 ? 0 : _fees[0],
        timestamp,
        false
      );
      _investData.tokenBalances[i] = tokenBalance;
    }

    unchecked {
      // overflow is not possible
      totalReceivedCurrency += allSwappedCurrency;
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
