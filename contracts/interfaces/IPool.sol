// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6;
pragma abicoder v2;

contract IPool {
  struct PoolData {
    address entryToken;
    address[] poolTokens;
    uint8[] poolDistribution;
    uint256[] poolTokensBalances;
    uint8 poolSize;
    address feeAddress;
    uint8 investFee;
    uint8 successFee;
    uint256 totalReceivedCurrency;
    uint256 totalSuccessFee;
    uint256 totalManagerFee;
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
