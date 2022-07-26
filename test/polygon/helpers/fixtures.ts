import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// TODO delete quoter
import { ROUTER_ADDRESS, WETH, WMATIC, USDC, AAVE, QUOTER } from "./constants";

import {
  Pool__factory,
  UniswapV3Exchange__factory,
} from "../../../typechain-types";

export async function deployFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const uniswapExchange = await new UniswapV3Exchange__factory(owner).deploy(
    ROUTER_ADDRESS,
    3000
  );

  const maticPool = await new Pool__factory(owner).deploy(
    WMATIC,
    owner.address,
    10,
    10,
    uniswapExchange.address,
    QUOTER,
    parseEther("1")
  );
}
