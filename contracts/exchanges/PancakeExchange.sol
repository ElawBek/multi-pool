// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/IExchange.sol";

/// @title PancakeExchange
contract PancakeExchange is IExchange, Ownable {
  using TransferHelper for address;

  /// @notice PancakeRouter
  IUniswapV2Router01 public immutable swapRouter;

  /// @param _swapRouter - address of PancakeSwap router
  constructor(address _swapRouter) {
    swapRouter = IUniswapV2Router01(_swapRouter);
  }

  /// @dev wrapper above function swap in the pancake router
  function swap(
    address tokenIn,
    address tokenOut,
    uint256 deadline,
    uint256 amount,
    address recipient,
    bool inputIsNativeToken
  ) external payable override onlyOwner returns (uint256) {
    address[] memory path = new address[](2);
    path[0] = tokenIn;
    path[1] = tokenOut;

    uint256[] memory amountOut = new uint256[](2);
    if (inputIsNativeToken) {
      amountOut = swapRouter.swapExactETHForTokens{ value: amount }(
        0,
        path,
        recipient,
        deadline
      );

      return amountOut[1];
    }

    tokenIn.safeApprove(address(swapRouter), amount);
    amountOut = swapRouter.swapExactTokensForTokens(
      amount,
      0,
      path,
      recipient,
      deadline
    );

    return amountOut[1];
  }
}
