// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "../interfaces/IExchange.sol";

contract UniswapV3Exchange is IExchange {
  /// @notice UniswapV3 SwapRouter
  ISwapRouter public swapRouter;

  /// @param _swapRouter - address of UniswapV3 SwapRouter
  constructor(address _swapRouter) {
    swapRouter = ISwapRouter(_swapRouter);
  }

  /// @dev wrapper above function swap in the uniswap router
  function swap(
    address tokenIn,
    address tokenOut,
    uint256 deadline,
    uint256 amount,
    address recipient,
    uint24 fee,
    bool inputIsNativeToken
  ) external payable override returns (uint256) {
    ISwapRouter.ExactInputSingleParams memory paramsForSwap = ISwapRouter
      .ExactInputSingleParams({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: fee,
        recipient: recipient,
        deadline: deadline,
        amountIn: amount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      });

    if (inputIsNativeToken) {
      return swapRouter.exactInputSingle{ value: amount }(paramsForSwap);
    }

    TransferHelper.safeApprove(tokenIn, address(swapRouter), amount);
    return swapRouter.exactInputSingle(paramsForSwap);
  }
}
