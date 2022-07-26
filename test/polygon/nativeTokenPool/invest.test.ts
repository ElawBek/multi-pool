import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";

import {
  deployMaticPoolFixture,
  investFixture,
  WETH,
  USDC,
  AAVE,
  WMATIC,
} from "../helpers";

import { Pool } from "../../../typechain-types";

describe("Investment", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let maticPool: Pool;

  describe("#invest", () => {
    beforeEach(async () => {
      ({ owner, alice, bob, maticPool } = await loadFixture(
        deployMaticPoolFixture
      ));
    });

    it("Trying to send amount less than the minimum via receive()", async () => {
      await expect(
        owner.sendTransaction({
          to: maticPool.address,
          value: parseEther("0.01"),
        })
      ).to.revertedWith("amount is too small");
    });

    it("Trying to send amount less than the minimum via invest()", async () => {
      await expect(
        maticPool.invest(parseEther("0.01"), [], { value: parseEther("0.01") })
      ).to.revertedWith("amount is too small");
    });

    it("Via invest() msg.value should be eq amount", async () => {
      await expect(
        maticPool.invest(parseEther("1"), [], { value: parseEther("2") })
      ).to.revertedWith("wrong value");
    });

    it("Successful invest should emit `Invested` event", async () => {
      await expect(
        maticPool
          .connect(alice)
          .invest(parseEther("1"), [], { value: parseEther("1") })
      )
        .to.emit(maticPool, "Invested")
        .withArgs(alice.address, parseEther("0.9"), anyValue, [50, 25, 25]);
    });

    it("Successful invest should transfer the invest fee to feeAddress", async () => {
      await expect(
        maticPool
          .connect(alice)
          .invest(parseEther("1"), [], { value: parseEther("1") })
      ).to.changeEtherBalance(owner, parseEther("0.1"));
    });
  });

  describe("State after investments", () => {
    beforeEach(async () => {
      ({ owner, alice, bob, maticPool } = await loadFixture(investFixture));
    });

    it("Common state variables", async () => {
      const { totalReceivedCurrency, totalInvestFee, poolTokensBalances } =
        await maticPool.poolData();

      expect(totalReceivedCurrency).to.eq(parseEther("99"));
      expect(totalInvestFee).to.eq(parseEther("11"));

      console.log(poolTokensBalances);
    });
  });
});
