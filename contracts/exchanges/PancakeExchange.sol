// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../interfaces/IExchange.sol";

// TODO quoter
contract PancakeExchange is IExchange {
  IUniswapV2Router02 public swapRouter;

  constructor(address _swapRouter) {
    swapRouter = IUniswapV2Router02(_swapRouter);
  }

  function setFee(uint24 x) external override {}

  function swap(
    address tokenIn,
    address tokenOut,
    uint256 deadline,
    uint256 amount,
    address recipient,
    bool inputIsNativeToken
  ) external payable override returns (uint256) {
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
