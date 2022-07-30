import { ethers, run } from "hardhat";
import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";

import {
  UniswapV3Exchange__factory,
  Pool__factory,
  IERC20__factory,
} from "../typechain-types";

const ROPSTEN_UNI = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
const ROPSTEN_WETH = "0xc778417E063141139Fce010982780140Aa0cD5Ab";
const ROPSTEN_SWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

async function main() {
  const [signer] = await ethers.getSigners();

  const uniswapExchange = await new UniswapV3Exchange__factory(signer).deploy(
    ROPSTEN_SWAP_ROUTER
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
    [3000, 500],
    [ROPSTEN_UNI, ROPSTEN_UNI],
    [55, 45]
  );
  await ethPool.deployed();

  const uniPool = await new Pool__factory(signer).deploy(
    ROPSTEN_UNI,
    signer.address,
    10,
    10,
    uniswapExchange.address,
    constants.AddressZero,
    parseEther("0.1"),
    "ETH-POOL",
    [3000],
    [ROPSTEN_WETH],
    [100]
  );
  await uniPool.deployed();

  const tx = await IERC20__factory.connect(ROPSTEN_UNI, signer).approve(
    uniPool.address,
    constants.MaxUint256
  );
  await tx.wait();

  await run("verify:verify", {
    address: uniswapExchange.address,
    contract: "contracts/exchanges/UniswapV3Exchange.sol:UniswapV3Exchange",
    constructorArguments: [ROPSTEN_SWAP_ROUTER],
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
      "ETH-POOL",
      [3000, 500],
      [ROPSTEN_UNI, ROPSTEN_UNI],
      [55, 45],
    ],
  });

  await run("verify:verify", {
    address: uniPool.address,
    contract: "contracts/Pool.sol:Pool",
    constructorArguments: [
      ROPSTEN_UNI,
      signer.address,
      10,
      10,
      uniswapExchange.address,
      constants.AddressZero,
      parseEther("0.1"),
      "ETH-POOL",
      [3000],
      [ROPSTEN_WETH],
      [100],
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
