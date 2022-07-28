import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { investUsdcFixture } from "../helpers";

import { Pool } from "../../../typechain-types";

describe("Withdraw", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let usdcPool: Pool;

  describe("#withdraw", () => {
    beforeEach(async () => {
      ({ owner, alice, usdcPool } = await loadFixture(investUsdcFixture));
    });

    it("Non-exists investment", async () => {
      await expect(usdcPool.connect(owner).withdraw(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful withdraw should emit `InvestmentWithdrawal` event", async () => {
      await expect(usdcPool.connect(alice).withdraw(0))
        .to.emit(usdcPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    it("Cannot withdraw when paused", async () => {
      await usdcPool.connect(owner).pause();

      await expect(usdcPool.connect(alice).withdraw(0)).to.revertedWith(
        "Pausable: paused"
      );
    });

    describe("Non-active investment", () => {
      beforeEach(async () => {
        await usdcPool.connect(alice).withdraw(0);
      });

      it("The non-active investment cannot be withdraw repeatedly", async () => {
        expect(
          (await usdcPool.investmentByUser(alice.address, 0)).active
        ).to.eq(false);

        await expect(usdcPool.connect(alice).withdraw(0)).to.revertedWith(
          "investment not active"
        );
      });

      it("Trying to execute `toggleRebalance` function with non-active investment should revert", async () => {
        await expect(
          usdcPool.connect(alice).toggleRebalance(0)
        ).to.revertedWith("investment not active");
      });

      it("Trying to execute `rebalance` function with non-active investment should revert", async () => {
        await expect(usdcPool.connect(alice).rebalance(0)).to.revertedWith(
          "investment not active"
        );
      });
    });
  });
});
