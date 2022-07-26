// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract IPool {
  struct PoolData {
    address owner;
    address entryAsset;
    address[] poolTokens;
    uint8[] poolDistribution;
    uint256[] poolTokensBalances;
    uint8 poolSize;
    address feeAddress;
    uint16 investFee;
    uint16 successFee;
    uint256 totalReceivedCurrency;
    uint256 totalInvestFee;
    uint256 totalSuccessFee;
  }

  struct PoolInfo {
    address entryAsset;
    address feeAddress;
    uint16 investFee;
    uint16 successFee;
    uint8 poolSize;
    uint8[] poolDistribution;
    address[] poolTokens;
  }

  struct InvestmentData {
    uint256 receivedCurrency;
    uint256[] tokenBalances;
    bool rebalanceEnabled;
    bool active;
    bool inputIsNativeToken;
  }

  event Invested(
    address indexed user,
    uint256 amount,
    uint256[] tokenBalances,
    uint8[] tokenDistribution
  );
  event UnInvested(
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
  event Received(address sender, uint256 amount);
}
