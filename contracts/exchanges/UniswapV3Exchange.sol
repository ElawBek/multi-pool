// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/IExchange.sol";

contract UniswapV3Exchange is IExchange, Ownable {
  using TransferHelper for address;

  ISwapRouter public swapRouter;
  uint24 public fee;

  constructor(address _swapRouter, uint24 _fee) {
    swapRouter = ISwapRouter(_swapRouter);
    fee = _fee;
  }

  function setFee(uint24 newFee) external override onlyOwner {
    fee = newFee;
  }

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
