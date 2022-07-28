// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract IPool {
  struct PoolData {
    // owner of the pool
    address owner;
    address entryAsset;
    address[] poolTokens;
    uint8[] poolDistribution;
    uint256[] poolTokensBalances;
    // number of tokens in the pool
    uint8 poolSize;
    address feeAddress;
    uint8 investFee;
    uint8 successFee;
    uint256 totalReceivedCurrency;
    uint256 totalInvestFee;
    uint256 totalSuccessFee;
  }

  struct PoolInfo {
    address entryAsset;
    address feeAddress;
    uint8 investFee;
    uint8 successFee;
    uint8 poolSize;
    uint8[] poolDistribution;
    address[] poolTokens;
  }

  struct InvestmentData {
    // receivet entryAsset by user in current investment
    uint256 receivedCurrency;
    // tokenBalances which will be exchanged back to the input asset
    uint256[] tokenBalances;
    bool rebalanceEnabled;
    bool active;
  }

  event Invested(
    address indexed user,
    uint256 amount,
    uint256[] tokenBalances,
    uint8[] tokenDistribution
  );
  event InvestmentWithdrawal(
    address indexed user,
    uint256 maticAmount,
    uint256 investmentId
  );
  event Rebalanced(
    address indexed user,
    uint256 investmentId,
    uint256[] tokenBalances,
    uint8[] tokenDistribution
  );
  event ToggleRebalance(
    address indexed user,
    uint256 investmentId,
    bool rebalanceEnabled
  );
  event Received(address sender, uint256 amount);
}
