// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IERC20 {
  function balanceOf(address owner) external view returns (uint256);

  function approve(address to, uint256 amount) external returns (bool);
}
