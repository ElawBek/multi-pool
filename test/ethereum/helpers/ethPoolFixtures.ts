import { ethers } from "hardhat";

import { parseEther } from "ethers/lib/utils";

import { ROUTER_ADDRESS, WETH, DAI, USDC, UNI } from "./constants";

import {
  Pool__factory,
  UniswapV3Exchange__factory,
} from "../../../typechain-types";

export async function deployMaticPoolFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS,
    [3000, 3000, 3000]
  );

  const ethPool = await new Pool__factory(owner).deploy(
    WETH,
    owner.address,
    10,
    10,
    uniswapExchange.address,
    WETH,
    parseEther("1"),
    "ETH-POOL",
    [DAI, USDC, UNI],
    [50, 25, 25]
  );

  await uniswapExchange.transferOwnership(ethPool.address);

  return { uniswapExchange, ethPool, owner, alice, bob };
}

export async function investFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS,
    [3000, 3000, 3000]
  );

  const ethPool = await new Pool__factory(owner).deploy(
    WETH,
    owner.address,
    10,
    10,
    uniswapExchange.address,
    WETH,
    parseEther("1"),
    "ETH-POOL",
    [DAI, USDC, UNI],
    [50, 25, 25]
  );

  await uniswapExchange.transferOwnership(ethPool.address);

  await alice.sendTransaction({
    to: ethPool.address,
    value: parseEther("100"),
  });

  await bob.sendTransaction({
    to: ethPool.address,
    value: parseEther("10"),
  });

  return { uniswapExchange, ethPool, owner, alice, bob };
}
