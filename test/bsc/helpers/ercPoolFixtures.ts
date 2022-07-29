import { ethers, network } from "hardhat";

import { parseEther } from "ethers/lib/utils";
import { constants } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  ROUTER_ADDRESS,
  WETH,
  BUSD,
  CAKE,
  WBNB,
  BUSD_OWNER_FROM_MAINNET,
} from "./constants";

import {
  Pool__factory,
  PancakeExchange__factory,
  IERC20__factory,
} from "../../../typechain-types";

async function unlockAccount(alice: SignerWithAddress, bob: SignerWithAddress) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [BUSD_OWNER_FROM_MAINNET],
  });

  const BUSD_OWNER = await ethers.getSigner(BUSD_OWNER_FROM_MAINNET);
  const busd = IERC20__factory.connect(BUSD, BUSD_OWNER);

  await busd.connect(BUSD_OWNER).transfer(alice.address, parseEther("1000"));
  await busd.connect(BUSD_OWNER).transfer(bob.address, parseEther("1000"));

  return { busd };
}

export async function deployBusdPoolFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  await unlockAccount(alice, bob);

  const pancakeExchange = await new PancakeExchange__factory(owner).deploy(
    ROUTER_ADDRESS
  );

  const busdPool = await new Pool__factory(owner).deploy(
    BUSD, // entry asset
    owner.address, // fee address
    10, // invest fee
    10, // success fee
    pancakeExchange.address, // swap router
    constants.AddressZero, // wrap above native currency (BNB)
    parseEther("1"), // min invest
    "BUSD-POOL", // name
    [WETH, WBNB, CAKE], // tokens
    [50, 25, 25] // distribution
  );

  await pancakeExchange.transferOwnership(busdPool.address);

  return { pancakeExchange, busdPool, owner, alice, bob };
}

export async function investBusdFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const { busd } = await unlockAccount(alice, bob);

  const pancakeExchange = await new PancakeExchange__factory(owner).deploy(
    ROUTER_ADDRESS
  );

  const busdPool = await new Pool__factory(owner).deploy(
    BUSD, // entry asset
    owner.address, // fee address
    10, // invest fee
    10, // success fee
    pancakeExchange.address, // swap router
    constants.AddressZero, // wrap above native currency (BNB)
    parseEther("1"), // min invest
    "BUSD-POOL", // name
    [WETH, WBNB, CAKE], // tokens
    [50, 25, 25] // distribution
  );

  await pancakeExchange.transferOwnership(busdPool.address);

  await busd.connect(alice).approve(busdPool.address, parseEther("1000"));
  await busdPool.connect(alice).invest(parseEther("1000"));

  await busd.connect(bob).approve(busdPool.address, parseEther("500"));
  await busdPool.connect(bob).invest(parseEther("500"));

  return { pancakeExchange, busdPool, owner, alice, bob };
}
