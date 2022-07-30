import { ethers, network } from "hardhat";

import { parseEther } from "ethers/lib/utils";
import { constants } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  ROUTER_ADDRESS,
  WETH,
  DAI,
  UNI,
  USDC,
  DAI_OWNER_FROM_MAINNET,
} from "./constants";

import {
  Pool__factory,
  UniswapV3Exchange__factory,
  IERC20__factory,
} from "../../../typechain-types";

async function unlockAccount(alice: SignerWithAddress, bob: SignerWithAddress) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [DAI_OWNER_FROM_MAINNET],
  });

  const DAI_OWNER = await ethers.getSigner(DAI_OWNER_FROM_MAINNET);
  const dai = IERC20__factory.connect(DAI, DAI_OWNER);

  await dai.connect(DAI_OWNER).transfer(alice.address, parseEther("1000"));
  await dai.connect(DAI_OWNER).transfer(bob.address, parseEther("1000"));

  return { dai };
}

export async function deployDaiPoolFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  await unlockAccount(alice, bob);

  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS
  );

  // DAI - pool
  // DAI - ETH 3000 fee
  // DAI - USDC 100 fee
  // DAI - UNI 3000 fee
  const daiPool = await new Pool__factory(owner).deploy(
    DAI, // entry asset
    owner.address, // fee address
    10, // invest fee
    10, // success fee
    uniswapExchange.address, // swap router
    constants.AddressZero, // wrap above native currency (ETH)
    parseEther("1"), // min invest
    "DAI-POOL", // pool name
    [3000, 100, 3000],
    [WETH, USDC, UNI], // tokens
    [50, 25, 25] // distributions
  );

  return { uniswapExchange, daiPool, owner, alice, bob };
}

export async function investDaiFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const { dai } = await unlockAccount(alice, bob);

  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS
  );

  // DAI - pool
  // DAI - ETH 3000 fee
  // DAI - USDC 100 fee
  // DAI - UNI 3000 fee
  const daiPool = await new Pool__factory(owner).deploy(
    DAI, // entry asset
    owner.address, // fee address
    10, // invest fee
    10, // success fee
    uniswapExchange.address, // swap router
    constants.AddressZero, // wrap above native currency (ETH)
    parseEther("1"), // min invest
    "DAI-POOL", // pool name
    [3000, 100, 3000],
    [WETH, USDC, UNI], // tokens
    [50, 25, 25] // distributions
  );

  await dai.connect(alice).approve(daiPool.address, parseEther("1000"));
  await daiPool.connect(alice).invest(parseEther("1000"));

  await dai.connect(bob).approve(daiPool.address, parseEther("500"));
  await daiPool.connect(bob).invest(parseEther("500"));

  return { uniswapExchange, daiPool, owner, alice, bob };
}
