import { run } from "hardhat";

import {
  FEES,
  SWAP_ROUTER,
  ENTRY_ASSET,
  FEE_ADDRESS,
  INVEST_FEE,
  SUCCESS_FEE,
  MIN_INVEST,
  POOL_NAME,
  WRAP_OF_NATIVE_TOKEN,
  TOKENS,
  DISTRIBUTIONS,
} from "./ethereumDeploy";

// new contract from etherscan
const POOL_ADDRESS = "";

// verify new pool address with constructor arguments
async function main() {
  await run("verify:verify", {
    address: POOL_ADDRESS,
    contract: "contracts/Pool.sol:Pool",
    constructorArguments: [
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
      DISTRIBUTIONS,
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
