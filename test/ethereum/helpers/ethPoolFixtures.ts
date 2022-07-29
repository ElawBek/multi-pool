import { ethers } from "hardhat";

import { parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { ROUTER_ADDRESS, WETH, DAI, USDC, UNI } from "./constants";

import {
  Pool__factory,
  UniswapV3Exchange__factory,
} from "../../../typechain-types";

export async function deployEthPoolFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  // ETH - pool
  // ETH - DAI 3000 fee  0.3%
  // ETH - USDC 500 fee  0.05%
  // ETH - UNI 3000 fee  0.3%
  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS,
    [3000, 500, 3000]
  );

  const ethPool = await new Pool__factory(owner).deploy(
    WETH, // entry asset
    owner.address, // fee address
    10, // invest fee
    10, // success fee
    uniswapExchange.address, // swap router
    WETH, //  wrap above native currency (ETH)
    parseEther("1"), // min invest
    "ETH-POOL", // pool name
    [DAI, USDC, UNI], // tokens
    [50, 25, 25] // distributions
  );

  await uniswapExchange.transferOwnership(ethPool.address);

  return { uniswapExchange, ethPool, owner, alice, bob };
}

export async function investFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  // ETH - pool
  // ETH - DAI 3000 fee  0.3%
  // ETH - USDC 500 fee  0.05%
  // ETH - UNI 3000 fee  0.3%
  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS,
    [3000, 500, 3000]
  );

  const ethPool = await new Pool__factory(owner).deploy(
    WETH, // entry asset
    owner.address, // fee address
    10, // invest fee
    10, // success fee
    uniswapExchange.address, // swap router
    WETH, //  wrap above native currency (ETH)
    parseEther("1"), // min invest
    "ETH-POOL", // pool name
    [DAI, USDC, UNI], // tokens
    [50, 25, 25] // distributions
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

export async function getSwapper(alice: SignerWithAddress) {
  const uniswapExchangeHelper = await new UniswapV3Exchange__factory(
    alice
  ).deploy(ROUTER_ADDRESS, [3000]);

  return { uniswapExchangeHelper };
}
