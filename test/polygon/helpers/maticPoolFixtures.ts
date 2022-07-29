import { ethers } from "hardhat";

import { parseEther } from "ethers/lib/utils";

import { ROUTER_ADDRESS, WETH, WMATIC, USDC, USDT } from "./constants";

import {
  Pool__factory,
  UniswapV3Exchange__factory,
} from "../../../typechain-types";

export async function deployMaticPoolFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  // MATIC - pool
  // MATIC - WETH 500 fee
  // MATIC - USDC 500 fee
  // MATIC - USDT 500 fee
  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS,
    [500, 500, 500]
  );

  const maticPool = await new Pool__factory(owner).deploy(
    WMATIC, // entry asset
    owner.address, // fee address
    10, // invest fee
    10, // success fee
    uniswapExchange.address, // swap router
    WMATIC, // wrap above native currency (MATIC)
    parseEther("1"), // min invest
    "MATIC-POOL", // pool name
    [WETH, USDC, USDT], // tokens
    [50, 25, 25] // distribution
  );

  await uniswapExchange.transferOwnership(maticPool.address);

  return { uniswapExchange, maticPool, owner, alice, bob };
}

export async function investFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  // MATIC - pool
  // MATIC - WETH 500 fee
  // MATIC - USDC 500 fee
  // MATIC - USDT 500 fee
  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS,
    [500, 500, 500]
  );

  const maticPool = await new Pool__factory(owner).deploy(
    WMATIC, // entry asset
    owner.address, // fee address
    10, // invest fee
    10, // success fee
    uniswapExchange.address, // swap router
    WMATIC, // wrap above native currency (MATIC)
    parseEther("1"), // min invest
    "MATIC-POOL", // pool name
    [WETH, USDC, USDT], // tokens
    [50, 25, 25] // distribution
  );
  await uniswapExchange.transferOwnership(maticPool.address);

  await alice.sendTransaction({
    to: maticPool.address,
    value: parseEther("100"),
  });

  await bob.sendTransaction({
    to: maticPool.address,
    value: parseEther("10"),
  });

  return { uniswapExchange, maticPool, owner, alice, bob };
}
