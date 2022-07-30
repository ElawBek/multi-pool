// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "./interfaces/IExchange.sol";
import "./interfaces/IPool.sol";

/// @title PoolStorage
contract PoolStorage is Ownable, IPool, Pausable, ReentrancyGuard {
  /// @notice wrapper of exchange's swap router
  IExchange internal immutable _swapRouter;
  /// @notice address to check if entryAsset is a native blockchain token or not.
  address internal immutable _wrapOfNativeToken;

  /**
   * @notice fee of each pool
   *
   * @dev all pools on uniswap have the fee.
   * e.g - pool entryAsset - poolInfo.poolTokens[i] - fee 3000 (3000 = 0.3%)
   *       pool entryAsset - poolInfo.poolTokens[i+1] - fee 100 (100 = 0.01%)
   *       pool entryAsset - poolInfo.poolTokens[i+2] - fee 10000 (10000 = 1%)
   *       pool entryAsset - poolInfo.poolTokens[i+3] - fee 500 (500 = 0.05%)
   * @dev if swapRouter - PancakeExchange - a fees array must be empty!
   */
  uint24[] public fees;

  /// @notice the name of the token pool.
  string public name;
  /// @notice the minimum possible amount of tokens for investment.
  uint256 internal _minInvest;

  PoolInfo public poolInfo;

  /// @notice current swapped tokens balances.
  uint256[] internal _poolTokensBalances;
  /// @notice current entryAsset in the contract.
  uint256 public totalReceivedCurrency;
  /// @notice the amount of investment fees over time.
  uint256 public totalInvestFee;
  /// @notice the amount of success fees over time.
  uint256 public totalSuccessFee;

  /// @notice investment data.
  mapping(address => InvestmentData[]) internal _investmentDataByUser;

  constructor(address swapRouter_, address wrapOfNativeToken_) {
    _swapRouter = IExchange(swapRouter_);
    _wrapOfNativeToken = wrapOfNativeToken_;
  }

  modifier validDistribution(uint8[] memory _poolDistribution) {
    uint8 res;
    for (uint256 i; i < _poolDistribution.length; i++) {
      res += _poolDistribution[i];
    }
    require(res == 100, "distribution must be eq 100");
    _;
  }

  /**
   * @notice pause pool.
   * @dev can be executed only by pool owner.
   * @dev emits `Paused` event.
   * */
  function pause() external onlyOwner {
    _pause();
  }

  /**
   * @notice unpause pool.
   * @dev can be executed only by pool owner.
   * @dev emits `Unpaused` event.
   * */
  function unpause() external onlyOwner {
    _unpause();
  }

  /**
   * @notice set the new fee address for charging pool fee.
   * @dev reverts when new fee address is equal to the current address or address(0).
   * @dev can be executed only by pool owner.
   * @dev can be executed only if the pool is on pause.
   * */
  function setFeeAddress(address _feeAddress) external onlyOwner whenPaused {
    require(poolInfo.feeAddress != _feeAddress, "this address is already set");
    require(_feeAddress != address(0), "new fee address is address(0)");

    poolInfo.feeAddress = _feeAddress;
  }

  /**
   * @notice set the new invest fee.
   * @dev reverts when new invest fee is equal to the current or more than 50.
   * @dev can be executed only by pool owner.
   * @dev can be executed only if the pool is on pause.
   * */
  function setInvestFee(uint8 newInvestFee) external onlyOwner whenPaused {
    require(poolInfo.investFee != newInvestFee, "this fee is already set");
    require(newInvestFee <= 50, "new invest fee is too big");

    poolInfo.investFee = newInvestFee;
  }

  /**
   * @notice set the new success fee.
   * @dev reverts when new success fee is equal to the current or more than 50.
   * @dev can be executed only by pool owner.
   * @dev can be executed only if the pool is on pause.
   * */
  function setSuccessFee(uint8 newSuccessFee) external onlyOwner whenPaused {
    require(poolInfo.successFee != newSuccessFee, "this fee is already set");
    require(newSuccessFee <= 50, "new success fee is too big");

    poolInfo.successFee = newSuccessFee;
  }

  /**
   * @notice set the new minimum possible amount of tokens for investment.
   * @dev reverts when new minInvestment is equal zero.
   * @dev can be executed only by pool owner.
   * @dev can be executed only if the pool is on pause.
   * */
  function setMinInvestmentLimit(uint256 _minInvestmentLimit)
    external
    onlyOwner
    whenPaused
  {
    require(_minInvestmentLimit > 0, "new min invest is zero");
    _minInvest = _minInvestmentLimit;
  }

  /**
   * @notice set the new tokens distributions.
   * @dev reverts when the sum of all new distributions is not equal 100.
   * @dev can be executed only by pool owner.
   * @dev can be executed only if the pool is on pause.
   * */
  function setPoolTokensDistributions(uint8[] memory poolDistributions)
    external
    onlyOwner
    whenPaused
    validDistribution(poolDistributions)
  {
    poolInfo.poolDistribution = poolDistributions;
  }

  /**
   * @notice function called by `receive` or `invest`.
   * @dev emits the `Invested` event.
   * */
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
    uint256 investmentAmount;
    unchecked {
      // overflow is not possible
      investmentAmount = amount - managerFee;
      totalReceivedCurrency += investmentAmount;
    }

    uint256[] memory tokenBalances = new uint256[](_poolInfo.poolSize);
    if (!inputIsNativeToken) {
      TransferHelper.safeApprove(
        _poolInfo.entryAsset,
        address(_swapRouter),
        investmentAmount
      );
    }
    uint256 timestamp;
    unchecked {
      // overflow is not possible
      timestamp = block.timestamp + 1200; // 20 mins
    }
    uint24[] memory _fees = fees;

    for (uint256 i; i < _poolInfo.poolSize; i++) {
      uint256 amountForToken;
      unchecked {
        // overflow is not possible
        amountForToken =
          (investmentAmount * _poolInfo.poolDistribution[i]) /
          100;
      }

      if (amountForToken == 0) {
        continue;
      }
      uint256 tokenBalance = _entryAssetToToken(
        _poolInfo.entryAsset,
        amountForToken,
        i,
        _fees.length == 0 ? 0 : _fees[0],
        timestamp,
        inputIsNativeToken
      );
      tokenBalances[i] = tokenBalance;
    }

    _investmentDataByUser[investor].push(
      InvestmentData({
        receivedCurrency: investmentAmount,
        tokenBalances: tokenBalances,
        rebalanceEnabled: true,
        active: true
      })
    );

    if (managerFee > 0) {
      unchecked {
        // overflow is not possible
        totalInvestFee += managerFee;
      }

      if (inputIsNativeToken) {
        TransferHelper.safeTransferETH(_poolInfo.feeAddress, managerFee);
      } else {
        TransferHelper.safeTransfer(
          _poolInfo.entryAsset,
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

  /// @notice helper function to exchange the entry asset for a token from the pool
  function _entryAssetToToken(
    address entryAssetAddress,
    uint256 amount,
    uint256 i,
    uint24 fee,
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
        fee,
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
      fee,
      inputIsNativeToken
    );
    _poolTokensBalances[i] += tokenBalance;

    return tokenBalance;
  }

  /// @notice helper function to exchange a token from the pool for the entry asset
  function _tokensToEntryAsset(
    uint256 timestamp,
    uint256 tokenBalance,
    uint256 i,
    uint24 fee
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
      fee,
      false
    );
    _poolTokensBalances[i] -= tokenBalance;
  }
}
