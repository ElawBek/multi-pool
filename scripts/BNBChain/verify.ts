import { run } from "hardhat";

import {
  PANCAKE_ROUTER,
  ENTRY_ASSET,
  FEE_ADDRESS,
  INVEST_FEE,
  SUCCESS_FEE,
  MIN_INVEST,
  POOL_NAME,
  WRAP_OF_NATIVE_TOKEN,
  TOKENS,
  DISTRIBUTIONS,
} from "./BNBDeploy";

// new contract from etherscan
const PANCAKE_EXCHANGE_ADDRESS = "";
const POOL_ADDRESS = "";

async function main() {
  await run("verify:verify", {
    address: PANCAKE_EXCHANGE_ADDRESS,
    contract: "contracts/exchanges/PancakeExchange.sol:PancakeExchange",
    constructorArguments: [PANCAKE_ROUTER],
  });

  await run("verify:verify", {
    address: POOL_ADDRESS,
    contract: "contracts/Pool.sol:Pool",
    constructorArguments: [
      ENTRY_ASSET,
      FEE_ADDRESS,
      INVEST_FEE,
      SUCCESS_FEE,
      PANCAKE_EXCHANGE_ADDRESS,
      WRAP_OF_NATIVE_TOKEN,
      MIN_INVEST,
      POOL_NAME,
      TOKENS,
      DISTRIBUTIONS,
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
