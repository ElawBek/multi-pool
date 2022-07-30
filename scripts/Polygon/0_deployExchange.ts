import { ethers, run } from "hardhat";

import { UniswapV3Exchange__factory } from "../../typechain-types";

// uniswap router on mainnet
export const UNISWAP_SWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

// Only once in polygon!
async function main() {
  const [signer] = await ethers.getSigners();

  const uniswapExchange = await new UniswapV3Exchange__factory(signer).deploy(
    UNISWAP_SWAP_ROUTER
  );
  await uniswapExchange.deployed();

  // verify exchange code on polygonscan
  await run("verify:verify", {
    address: uniswapExchange.address,
    contract: "contracts/exchanges/UniswapV3Exchange.sol:UniswapV3Exchange",
    constructorArguments: [UNISWAP_SWAP_ROUTER],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
