import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { deployFixture } from "./fixtures";

import { Pool } from "../typechain-types";

describe("State", () => {
  let pool: Pool;

  beforeEach(async () => {
    ({ pool } = await loadFixture(deployFixture));
  });

  it("State", async () => {
    console.log(await pool.poolInfo());
    console.log(await pool.get());
    console.log(await pool.swapRouter());
    console.log(await pool.fee());
    console.log(await pool.owner());
  });
});
