import { ethers, run } from "hardhat";
import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";

import {
  PancakeExchange__factory,
  Pool__factory,
  IERC20__factory,
} from "../typechain-types";

const TESTNET_WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
const TESTNET_USDT = "0x7ef95a0FEE0Dd31b22626fA2e10Ee6A223F8a684";
const TESTNET_BUSD = "0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7";
const TESTNET_DAI = "0x8a9424745056Eb399FD19a0EC26A14316684e274";
const TESTNET_SWAP_ROUTER = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";

async function main() {
  const [signer] = await ethers.getSigners();

  const pancakeExchange = await new PancakeExchange__factory(signer).deploy(
    TESTNET_SWAP_ROUTER
  );
  await pancakeExchange.deployed();

  const bnbPool = await new Pool__factory(signer).deploy(
    TESTNET_WBNB,
    signer.address,
    10,
    10,
    pancakeExchange.address,
    TESTNET_WBNB,
    parseEther("0.1"),
    "BNB-POOL",
    [],
    [TESTNET_USDT, TESTNET_BUSD, TESTNET_DAI],
    [50, 25, 25]
  );
  await bnbPool.deployed();

  const busdPool = await new Pool__factory(signer).deploy(
    TESTNET_BUSD, // entry asset
    signer.address, // fee address
    10, // invest fee
    10, // success fee
    pancakeExchange.address, // swap router
    constants.AddressZero, // wrap above native currency (BNB)
    parseEther("1"), // min invest
    "BUSD-POOL", // name
    [], // empty fee array
    [TESTNET_USDT, TESTNET_DAI, TESTNET_WBNB], // tokens
    [50, 25, 25] // distribution
  );
  await busdPool.deployed();

  const tx = await IERC20__factory.connect(TESTNET_BUSD, signer).approve(
    busdPool.address,
    constants.MaxUint256
  );
  await tx.wait();

  await run("verify:verify", {
    address: pancakeExchange.address,
    contract: "contracts/exchanges/PancakeExchange.sol:PancakeExchange",
    constructorArguments: [TESTNET_SWAP_ROUTER],
  });

  await run("verify:verify", {
    address: bnbPool.address,
    contract: "contracts/Pool.sol:Pool",
    constructorArguments: [
      TESTNET_WBNB,
      signer.address,
      10,
      10,
      pancakeExchange.address,
      TESTNET_WBNB,
      parseEther("0.1"),
      "BNB-POOL",
      [],
      [TESTNET_USDT, TESTNET_BUSD, TESTNET_DAI],
      [50, 25, 25],
    ],
  });

  await run("verify:verify", {
    address: busdPool.address,
    contract: "contracts/Pool.sol:Pool",
    constructorArguments: [
      TESTNET_BUSD,
      signer.address,
      10,
      10,
      pancakeExchange.address,
      constants.AddressZero,
      parseEther("1"),
      "BUSD-POOL",
      [],
      [TESTNET_USDT, TESTNET_DAI, TESTNET_WBNB],
      [50, 25, 25],
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
