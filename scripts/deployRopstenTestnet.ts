import { ethers, run } from "hardhat";
import { parseEther } from "ethers/lib/utils";

import { UniswapV3Exchange__factory, Pool__factory } from "../typechain-types";

const ROPSTEN_UNI = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
const ROPSTEN_WETH = "0xc778417E063141139Fce010982780140Aa0cD5Ab";
const ROPSTEN_SWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

async function main() {
  const [signer] = await ethers.getSigners();

  const uniswapExchange = await new UniswapV3Exchange__factory(signer).deploy(
    ROPSTEN_SWAP_ROUTER,
    3000
  );
  await uniswapExchange.deployed();

  const ethPool = await new Pool__factory(signer).deploy(
    ROPSTEN_WETH,
    signer.address,
    10,
    10,
    uniswapExchange.address,
    ROPSTEN_WETH,
    parseEther("0.1"),
    "ETH-POOL",
    [ROPSTEN_UNI],
    [100]
  );
  await ethPool.deployed();

  const tx = await uniswapExchange
    .connect(signer)
    .transferOwnership(ethPool.address);
  await tx.wait();

  await run("verify:verify", {
    address: uniswapExchange.address,
    contract: "contracts/exchanges/UniswapV3Exchange.sol:UniswapV3Exchange",
    constructorArguments: [ROPSTEN_SWAP_ROUTER, 3000],
  });

  await run("verify:verify", {
    address: ethPool.address,
    contract: "contracts/Pool.sol:Pool",
    constructorArguments: [
      ROPSTEN_WETH,
      signer.address,
      10,
      10,
      uniswapExchange.address,
      ROPSTEN_WETH,
      parseEther("0.1"),
      [ROPSTEN_UNI],
      [100],
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
