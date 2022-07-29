import { run } from "hardhat";

import {
  FEES,
  UNISWAP_SWAP_ROUTER,
  ENTRY_ASSET,
  FEE_ADDRESS,
  INVEST_FEE,
  SUCCESS_FEE,
  MIN_INVEST,
  POOL_NAME,
  WRAP_OF_NATIVE_TOKEN,
  TOKENS,
  DISTRIBUTIONS,
} from "./polygonDeploy";

// new contract from etherscan
const UNISWAP_EXCHANGE_ADDRESS = "";
const POOL_ADDRESS = "";

async function main() {
  await run("verify:verify", {
    address: UNISWAP_EXCHANGE_ADDRESS,
    contract: "contracts/exchanges/UniswapV3Exchange.sol:UniswapV3Exchange",
    constructorArguments: [UNISWAP_SWAP_ROUTER, FEES],
  });

  await run("verify:verify", {
    address: POOL_ADDRESS,
    contract: "contracts/Pool.sol:Pool",
    constructorArguments: [
      ENTRY_ASSET,
      FEE_ADDRESS,
      INVEST_FEE,
      SUCCESS_FEE,
      UNISWAP_EXCHANGE_ADDRESS,
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
