// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/IExchange.sol";

contract UniswapV3Exchange is IExchange, Ownable {
  using TransferHelper for address;

  /// @notice UniswapV3 SwapRouter
  ISwapRouter public swapRouter;

  /**
   * @notice fee of all pools
   *
   * @dev all pools on uniswap must have the same commission defined in this variable.
   * e.g - pool entryAsset - poolInfo.poolTokens[i] - fee 3000 (3000 = 0.3% on uniswapV3)
   * e.g - pool entryAsset - poolInfo.poolTokens[i+1] - fee 3000
   * e.g - pool entryAsset - poolInfo.poolTokens[i+2] - fee 3000
   */
  uint24 public fee;

  /// @param _swapRouter - address of UniswapV3 SwapRouter
  /// @param _fee - fee of all pools
  constructor(address _swapRouter, uint24 _fee) {
    swapRouter = ISwapRouter(_swapRouter);
    fee = _fee;
  }

  /// @dev wrapper above function swap in the uniswap router
  function swap(
    address tokenIn,
    address tokenOut,
    uint256 deadline,
    uint256 amount,
    address recipient,
    bool inputIsNativeToken
  ) external payable override onlyOwner returns (uint256) {
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

    tokenIn.safeApprove(address(swapRouter), amount);
    return swapRouter.exactInputSingle(paramsForSwap);
  }
}
