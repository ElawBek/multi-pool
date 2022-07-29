import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther, formatEther } from "ethers/lib/utils";

import { deployEthPoolFixture } from "./helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { Pool } from "../../typechain-types";

describe("ETH - pool", () => {
  let ethPool: Pool;
  let alice: SignerWithAddress;

  describe("State", async () => {
    beforeEach(async () => {
      ({ alice, ethPool } = await loadFixture(deployEthPoolFixture));
    });

    it("test", async () => {
      for (let i = 0; i < 50; i++) {
        await ethPool
          .connect(alice)
          .invest(parseEther("100"), { value: parseEther("100") });

        console.log(formatEther(await alice.getBalance()));
        console.log(
          `tokenBalances: ${
            (await ethPool.investmentsByUser(alice.address))[i].tokenBalances
          }`
        );
        console.log(
          `poolTokensBalances: ${await ethPool.poolTokensBalances()}`
        );
        console.log(
          `totalReceivedCurrency: ${await ethPool.totalReceivedCurrency()}`
        );
      }

      for (let i = 0; i < 50; i++) {
        await ethPool.connect(alice).withdraw(i);

        console.log(formatEther(await alice.getBalance()));
        console.log(
          `tokenBalances: ${
            (await ethPool.investmentsByUser(alice.address))[i].tokenBalances
          }`
        );
        console.log(
          `poolTokensBalances: ${await ethPool.poolTokensBalances()}`
        );
        console.log(
          `totalReceivedCurrency: ${await ethPool.totalReceivedCurrency()}`
        );
      }
    });
  });
});
