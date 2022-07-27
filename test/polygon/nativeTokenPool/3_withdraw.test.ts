import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { investFixture } from "../helpers";

import { Pool } from "../../../typechain-types";

describe("Withdraw", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let maticPool: Pool;

  describe("#withdraw", () => {
    beforeEach(async () => {
      ({ owner, alice, maticPool } = await loadFixture(investFixture));
    });

    it("Non-exists investment", async () => {
      await expect(maticPool.connect(owner).withdraw(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful withdraw should emit `InvestmentWithdrawal` event", async () => {
      await expect(maticPool.connect(alice).withdraw(0))
        .to.emit(maticPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    it("Cannot withdraw when paused", async () => {
      await maticPool.connect(owner).pause();

      await expect(maticPool.connect(alice).withdraw(0)).to.revertedWith(
        "Pausable: paused"
      );
    });

    describe("Non-active investment", () => {
      beforeEach(async () => {
        await maticPool.connect(alice).withdraw(0);
      });

      it("The non-active investment cannot be withdraw repeatedly", async () => {
        expect(
          (await maticPool.investmentByUser(alice.address, 0)).active
        ).to.eq(false);

        await expect(maticPool.connect(alice).withdraw(0)).to.revertedWith(
          "investment not active"
        );
      });

      it("Trying to execute `toggleRebalance` function with non-active investment should revert", async () => {
        await expect(
          maticPool.connect(alice).toggleRebalance(0)
        ).to.revertedWith("investment not active");
      });

      it("Trying to execute `rebalance` function with non-active investment should revert", async () => {
        await expect(maticPool.connect(alice).rebalance(0)).to.revertedWith(
          "investment not active"
        );
      });
    });
  });
});
