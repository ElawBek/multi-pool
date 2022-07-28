import { ethers } from "hardhat";

import { parseEther } from "ethers/lib/utils";

import { ROUTER_ADDRESS, WETH, BUSD, CAKE, WBNB } from "./constants";

import {
  Pool__factory,
  PancakeExchange__factory,
} from "../../../typechain-types";

export async function deployBnbPoolFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const pancakeExchange = await new PancakeExchange__factory(owner).deploy(
    ROUTER_ADDRESS
  );

  const bnbPool = await new Pool__factory(owner).deploy(
    WBNB,
    owner.address,
    10,
    10,
    pancakeExchange.address,
    WBNB,
    parseEther("1"),
    "BNB-POOL",
    [WETH, BUSD, CAKE],
    [50, 25, 25]
  );

  await pancakeExchange.transferOwnership(bnbPool.address);

  return { pancakeExchange, bnbPool, owner, alice, bob };
}

export async function investFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const pancakeExchange = await new PancakeExchange__factory(owner).deploy(
    ROUTER_ADDRESS
  );

  const bnbPool = await new Pool__factory(owner).deploy(
    WBNB,
    owner.address,
    10,
    10,
    pancakeExchange.address,
    WBNB,
    parseEther("1"),
    "BNB-POOL",
    [WETH, BUSD, CAKE],
    [50, 25, 25]
  );

  await pancakeExchange.transferOwnership(bnbPool.address);

  await alice.sendTransaction({
    to: bnbPool.address,
    value: parseEther("100"),
  });

  await bob.sendTransaction({
    to: bnbPool.address,
    value: parseEther("10"),
  });

  return { pancakeExchange, bnbPool, owner, alice, bob };
}
