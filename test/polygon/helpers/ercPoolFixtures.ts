import { ethers, network } from "hardhat";

import { constants, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  ROUTER_ADDRESS,
  WETH,
  WMATIC,
  USDC,
  USDT,
  USDC_OWNER_FROM_MAINNET,
} from "./constants";

import {
  Pool__factory,
  UniswapV3Exchange__factory,
  IERC20__factory,
} from "../../../typechain-types";

async function unlockAccount(alice: SignerWithAddress, bob: SignerWithAddress) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [USDC_OWNER_FROM_MAINNET],
  });

  const USDC_OWNER = await ethers.getSigner(USDC_OWNER_FROM_MAINNET);
  const usdc = IERC20__factory.connect(USDC, USDC_OWNER);

  await usdc
    .connect(USDC_OWNER)
    .transfer(alice.address, BigNumber.from(1000 * 10 ** 6));
  await usdc
    .connect(USDC_OWNER)
    .transfer(bob.address, BigNumber.from(1000 * 10 ** 6));

  return { usdc };
}

export async function deployUsdcPoolFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  await unlockAccount(alice, bob);

  // USDC - 6 decimals
  // USDC - pool
  // USDC - WETH 500 fee
  // USDC - MATIC 500 fee
  // USDC - USDT 500 fee
  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS,
    [500, 500, 500]
  );

  const usdcPool = await new Pool__factory(owner).deploy(
    USDC, // entry asset
    owner.address, // fee address
    10, // invest fee
    10, // success fee
    uniswapExchange.address, // swap router
    constants.AddressZero, // wrap above native currency (ETH)
    BigNumber.from(10 ** 6), // min invest
    "USDC_POOL", // pool name
    [WETH, WMATIC, USDT], // tokens
    [50, 25, 25] // distributions
  );

  await uniswapExchange.transferOwnership(usdcPool.address);

  return { uniswapExchange, usdcPool, owner, alice, bob };
}

export async function investUsdcFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const { usdc } = await unlockAccount(alice, bob);

  // USDC - pool
  // USDC - WETH 500 fee
  // USDC - MATIC 500 fee
  // USDC - USDT 500 fee
  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS,
    [500, 500, 500]
  );

  const usdcPool = await new Pool__factory(owner).deploy(
    USDC, // entry asset
    owner.address, // fee address
    10, // invest fee
    10, // success fee
    uniswapExchange.address, // swap router
    constants.AddressZero, // wrap above native currency (ETH)
    BigNumber.from(10 ** 6), // min invest
    "USDC_POOL", // pool name
    [WETH, WMATIC, USDT], // tokens
    [50, 25, 25] // distributions
  );

  await uniswapExchange.transferOwnership(usdcPool.address);

  await usdc
    .connect(alice)
    .approve(usdcPool.address, BigNumber.from(1000 * 10 ** 6));
  await usdcPool.connect(alice).invest(BigNumber.from(1000 * 10 ** 6));

  await usdc
    .connect(bob)
    .approve(usdcPool.address, BigNumber.from(500 * 10 ** 6));
  await usdcPool.connect(bob).invest(BigNumber.from(500 * 10 ** 6));

  return { uniswapExchange, usdcPool, owner, alice, bob };
}
