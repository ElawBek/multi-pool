import { ethers } from "hardhat";

import { parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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
    WBNB, // entry asset
    owner.address, // fee address
    10, // invest fee
    10, // success fee
    pancakeExchange.address, // swap router
    WBNB, // wrap above native currency (BNB)
    parseEther("1"), // min invest
    "BNB-POOL", // pool name
    [], // empty fee array
    [WETH, BUSD, CAKE], // tokens
    [50, 25, 25] // distribution
  );

  return { pancakeExchange, bnbPool, owner, alice, bob };
}

export async function investFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const pancakeExchange = await new PancakeExchange__factory(owner).deploy(
    ROUTER_ADDRESS
  );

  const bnbPool = await new Pool__factory(owner).deploy(
    WBNB, // entry asset
    owner.address, // fee address
    10, // invest fee
    10, // success fee
    pancakeExchange.address, // swap router
    WBNB, // wrap above native currency (BNB)
    parseEther("1"), // min invest
    "BNB-POOL", // pool name
    [], // empty fee array
    [WETH, BUSD, CAKE], // tokens
    [50, 25, 25] // distribution
  );

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
