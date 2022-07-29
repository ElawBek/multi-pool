import { ethers } from "hardhat";
import { constants } from "ethers";

import { PancakeExchange__factory, Pool__factory } from "../../typechain-types";

export const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

export const ENTRY_ASSET = ""; // WBNB if entryAsset will be native token
export const FEE_ADDRESS = "";
export const INVEST_FEE = 0; // can't be gt 50
export const SUCCESS_FEE = 0; // can't be gt 50
export const MIN_INVEST = 1; // can't be eq 0
export const POOL_NAME = "";

// If entry asset is WBNB - WRAP_OF_NATIVE_TOKEN must be WBNB
export const WRAP_OF_NATIVE_TOKEN = constants.AddressZero; // or WBNB
export const TOKENS = ["", "", ""];
export const DISTRIBUTIONS = [33, 33, 34]; // sum must be eq 100

async function main() {
  const [signer] = await ethers.getSigners();

  const pancakeExchange = await new PancakeExchange__factory(signer).deploy(
    PANCAKE_ROUTER
  );
  await pancakeExchange.deployed();

  const bnbPool = await new Pool__factory(signer).deploy(
    ENTRY_ASSET,
    FEE_ADDRESS,
    INVEST_FEE,
    SUCCESS_FEE,
    pancakeExchange.address,
    WRAP_OF_NATIVE_TOKEN,
    MIN_INVEST,
    POOL_NAME,
    TOKENS,
    DISTRIBUTIONS
  );
  await bnbPool.deployed();

  // it's important
  const tx = await pancakeExchange
    .connect(signer)
    .transferOwnership(bnbPool.address);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
