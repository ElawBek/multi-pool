import { ethers } from "hardhat";

import { parseEther } from "ethers/lib/utils";

// TODO delete quoter
import { ROUTER_ADDRESS, WETH, WMATIC, USDC, AAVE, QUOTER } from "./constants";

import {
  Pool__factory,
  UniswapV3Exchange__factory,
} from "../../../typechain-types";

export async function deployMaticPoolFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS,
    3000
  );

  const maticPool = await new Pool__factory(owner).deploy(
    WMATIC,
    owner.address,
    10,
    10,
    uniswapExchange.address,
    QUOTER,
    parseEther("1"),
    [WETH, USDC, AAVE],
    [50, 25, 25]
  );

  await uniswapExchange.transferOwnership(maticPool.address);

  return { uniswapExchange, maticPool, owner, alice, bob };
}

export async function investFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS,
    3000
  );

  const maticPool = await new Pool__factory(owner).deploy(
    WMATIC,
    owner.address,
    10,
    10,
    uniswapExchange.address,
    QUOTER,
    parseEther("1"),
    [WETH, USDC, AAVE],
    [50, 25, 25]
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
