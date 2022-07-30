import { ethers, run } from "hardhat";

import { PancakeExchange__factory } from "../../typechain-types";

// pancake router on mainnet
export const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

// Only once!
async function main() {
  const [signer] = await ethers.getSigners();

  const pancakeExchange = await new PancakeExchange__factory(signer).deploy(
    PANCAKE_ROUTER
  );
  await pancakeExchange.deployed();

  // verify exchange code on bscscan
  await run("verify:verify", {
    address: pancakeExchange.address,
    contract: "contracts/exchanges/PancakeExchange.sol:PancakeExchange",
    constructorArguments: [PANCAKE_ROUTER],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
