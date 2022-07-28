import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { investBusdFixture } from "../helpers";

import { Pool } from "../../../typechain-types";

describe("Withdraw", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let busdPool: Pool;

  describe("#withdraw", () => {
    beforeEach(async () => {
      ({ owner, alice, busdPool } = await loadFixture(investBusdFixture));
    });

    it("Non-exists investment", async () => {
      await expect(busdPool.connect(owner).withdraw(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful withdraw should emit `InvestmentWithdrawal` event", async () => {
      await expect(busdPool.connect(alice).withdraw(0))
        .to.emit(busdPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    it("Cannot withdraw when paused", async () => {
      await busdPool.connect(owner).pause();

      await expect(busdPool.connect(alice).withdraw(0)).to.revertedWith(
        "Pausable: paused"
      );
    });

    describe("Non-active investment", () => {
      beforeEach(async () => {
        await busdPool.connect(alice).withdraw(0);
      });

      it("The non-active investment cannot be withdraw repeatedly", async () => {
        expect(
          (await busdPool.investmentByUser(alice.address, 0)).active
        ).to.eq(false);

        await expect(busdPool.connect(alice).withdraw(0)).to.revertedWith(
          "investment not active"
        );
      });

      it("Trying to execute `toggleRebalance` function with non-active investment should revert", async () => {
        await expect(
          busdPool.connect(alice).toggleRebalance(0)
        ).to.revertedWith("investment not active");
      });

      it("Trying to execute `rebalance` function with non-active investment should revert", async () => {
        await expect(busdPool.connect(alice).rebalance(0)).to.revertedWith(
          "investment not active"
        );
      });
    });
  });
});
