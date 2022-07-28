import { ethers, network } from "hardhat";

import { parseEther } from "ethers/lib/utils";
import { constants } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  ROUTER_ADDRESS,
  WETH,
  DAI,
  UNI,
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
    ROUTER_ADDRESS,
    [3000, 3000]
  );

  const daiPool = await new Pool__factory(owner).deploy(
    DAI,
    owner.address,
    10,
    10,
    uniswapExchange.address,
    constants.AddressZero,
    parseEther("1"),
    "DAI-POOL",
    [WETH, UNI],
    [75, 25]
  );

  await uniswapExchange.transferOwnership(daiPool.address);

  return { uniswapExchange, daiPool, owner, alice, bob };
}

export async function investDaiFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const { dai } = await unlockAccount(alice, bob);

  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS,
    [3000, 3000]
  );

  const daiPool = await new Pool__factory(owner).deploy(
    DAI,
    owner.address,
    10,
    10,
    uniswapExchange.address,
    constants.AddressZero,
    parseEther("1"),
    "DAI-POOL",
    [WETH, UNI],
    [75, 25]
  );

  await uniswapExchange.transferOwnership(daiPool.address);

  await dai.connect(alice).approve(daiPool.address, parseEther("1000"));
  await daiPool.connect(alice).invest(parseEther("1000"));

  await dai.connect(bob).approve(daiPool.address, parseEther("500"));
  await daiPool.connect(bob).invest(parseEther("500"));

  return { uniswapExchange, daiPool, owner, alice, bob };
}
