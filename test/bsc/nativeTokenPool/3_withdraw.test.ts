import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { getTokens, investFixture, WBNB } from "../helpers";

import { Pool, IERC20, IERC20__factory } from "../../../typechain-types";

describe("Withdraw", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let weth: IERC20;
  let busd: IERC20;
  let cake: IERC20;

  let bnbPool: Pool;

  async function getBalancesOf(address: string) {
    const balances = [];
    balances.push(await weth.balanceOf(address));
    balances.push(await busd.balanceOf(address));
    balances.push(await cake.balanceOf(address));

    return balances;
  }

  describe("#withdraw", () => {
    beforeEach(async () => {
      ({ owner, alice, bnbPool } = await loadFixture(investFixture));
      ({ busd, cake, weth } = getTokens(owner));
    });

    it("Non-exists investment", async () => {
      await expect(bnbPool.connect(owner).withdraw(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful withdraw should emit `InvestmentWithdrawal` event", async () => {
      await expect(bnbPool.connect(alice).withdraw(0))
        .to.emit(bnbPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    it("Cannot withdraw when paused", async () => {
      await bnbPool.connect(owner).pause();

      await expect(bnbPool.connect(alice).withdraw(0)).to.revertedWith(
        "Pausable: paused"
      );
    });

    describe("Non-active investment", () => {
      beforeEach(async () => {
        await bnbPool.connect(alice).withdraw(0);
      });

      it("The non-active investment cannot be withdraw repeatedly", async () => {
        expect((await bnbPool.investmentByUser(alice.address, 0)).active).to.eq(
          false
        );

        await expect(bnbPool.connect(alice).withdraw(0)).to.revertedWith(
          "investment not active"
        );
      });

      it("Trying to execute `toggleRebalance` function with non-active investment should revert", async () => {
        await expect(bnbPool.connect(alice).toggleRebalance(0)).to.revertedWith(
          "investment not active"
        );
      });

      it("Trying to execute `rebalance` function with non-active investment should revert", async () => {
        await expect(bnbPool.connect(alice).rebalance(0)).to.revertedWith(
          "investment not active"
        );
      });
    });
  });
});
