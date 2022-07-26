import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { deployFixture } from "./fixtures";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { Pool } from "../typechain-types";

describe("State", () => {
  let pool: Pool;
  let owner: SignerWithAddress;

  beforeEach(async () => {
    ({ pool, owner } = await loadFixture(deployFixture));
  });

  it("State", async () => {
    console.log(`swapRouter: ${await pool.swapRouter()}`);
    console.log(`poolTokensBalances: ${await pool.poolTokensBalances()}`);
    console.log(
      `investmentsByUser: ${await pool.investmentsByUser(owner.address)}`
    );
    console.log(`tokenList: ${await pool.tokenList()}`);
    console.log(
      `poolTokensDistributions: ${await pool.poolTokensDistributions()}`
    );
    console.log(`poolData: ${await pool.poolData()}`);
  });
});
