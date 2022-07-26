import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";
import { constants } from "ethers";

import {
  ROUTER_ADDRESS,
  AAVE,
  USDC,
  WETH,
  WMATIC,
  deployFixture,
} from "./fixtures";

import { Pool, IERC20__factory } from "../typechain-types";

describe("#invest", () => {
  let pool: Pool;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  beforeEach(async () => {
    ({ pool, owner, alice } = await loadFixture(deployFixture));
  });

  it("invest", async () => {
    await pool.connect(alice).initSecureInvestment(parseEther("1"), [], {
      value: parseEther("1"),
    });

    const weth = IERC20__factory.connect(WETH, owner);
    const usdc = IERC20__factory.connect(USDC, owner);
    const aave = IERC20__factory.connect(AAVE, owner);
    const wmatic = IERC20__factory.connect(WMATIC, owner);

    console.log(await weth.balanceOf(pool.address));
    console.log(await usdc.balanceOf(pool.address));
    console.log(await aave.balanceOf(pool.address));

    await pool.connect(alice).rebalance(0);

    console.log(await weth.balanceOf(pool.address));
    console.log(await usdc.balanceOf(pool.address));
    console.log(await aave.balanceOf(pool.address));

    await pool.connect(alice).toggleRebalance(0);

    await expect(pool.connect(alice).rebalance(0)).to.reverted;

    await pool.connect(alice).withdraw(0);

    console.log(await weth.balanceOf(pool.address));
    console.log(await usdc.balanceOf(pool.address));
    console.log(await aave.balanceOf(pool.address));
    console.log(await wmatic.balanceOf(alice.address));
  });
});
