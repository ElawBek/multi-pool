// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IExchange {
  function setFee(uint24 amount) external;

  function swap(
    address tokenIn,
    address tokenOut,
    uint256 deadline,
    uint256 amount,
    address recipient,
    bool inputIsNativeToken
  ) external payable returns (uint256);
}
