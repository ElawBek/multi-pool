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

import { Pool } from "../typechain-types";

describe("#invest", () => {
  let pool: Pool;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  beforeEach(async () => {
    ({ pool, owner, alice } = await loadFixture(deployFixture));
  });

  it("invest", async () => {
    console.log(await owner.getBalance());
    await alice.sendTransaction({ to: pool.address, value: parseEther("1") });
    console.log(await owner.getBalance());
  });
});
