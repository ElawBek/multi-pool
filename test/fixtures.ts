import { ethers } from "hardhat";

import { parseEther } from "ethers/lib/utils";
import { constants } from "ethers";

import { Pool__factory } from "../typechain-types";

export const ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
export const QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
export const WMATIC = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
export const WETH = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
export const USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
export const AAVE = "0xD6DF932A45C0f255f85145f286eA0b292B21C90B";

export async function deployFixture() {
  const [owner, alice] = await ethers.getSigners();

  const pool = await new Pool__factory(owner).deploy(
    WMATIC,
    owner.address,
    10,
    10,
    ROUTER_ADDRESS,
    QUOTER,
    parseEther("1"),
    3000,
    [WETH, USDC, AAVE],
    [25, 25, 50]
  );

  return { owner, pool, alice };
}
