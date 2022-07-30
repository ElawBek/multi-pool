import { ethers } from "hardhat";
import { constants } from "ethers";

import { Pool__factory } from "../../typechain-types";

// WBNB address from mainnet
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

export const ENTRY_ASSET = ""; // WBNB if entryAsset will be native token
export const FEE_ADDRESS = "";
export const INVEST_FEE = 0; // can't be gt 50
export const SUCCESS_FEE = 0; // can't be gt 50
export const SWAP_ROUTER = ""; // Router address from 0_deployExchange.ts
export const MIN_INVEST = 1; // can't be eq 0
export const POOL_NAME = "";

// In pancake it must be empty array
export const FEES = [];

// If entry asset is WBNB - WRAP_OF_NATIVE_TOKEN must be WBNB
export const WRAP_OF_NATIVE_TOKEN = constants.AddressZero; // or WBNB
export const TOKENS = ["", "", ""];
export const DISTRIBUTIONS = [33, 33, 34]; // sum must be eq 100

async function main() {
  const [signer] = await ethers.getSigners();

  const bnbPool = await new Pool__factory(signer).deploy(
    ENTRY_ASSET,
    FEE_ADDRESS,
    INVEST_FEE,
    SUCCESS_FEE,
    SWAP_ROUTER,
    WRAP_OF_NATIVE_TOKEN,
    MIN_INVEST,
    POOL_NAME,
    FEES,
    TOKENS,
    DISTRIBUTIONS
  );
  await bnbPool.deployed();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
