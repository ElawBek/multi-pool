import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { getTokens, investBusdFixture } from "../helpers";

import { Pool, IERC20 } from "../../../typechain-types";

describe("Rebalance", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let weth: IERC20;
  let wbnb: IERC20;
  let cake: IERC20;

  let busdPool: Pool;

  async function getBalancesOf(address: string) {
    const balances = [];
    balances.push(await weth.balanceOf(address));
    balances.push(await wbnb.balanceOf(address));
    balances.push(await cake.balanceOf(address));

    return balances;
  }

  describe("#rebalance", () => {
    beforeEach(async () => {
      ({ owner, alice, busdPool } = await loadFixture(investBusdFixture));
      ({ weth, wbnb, cake } = getTokens(owner));
    });

    it("Non-exists investment", async () => {
      await expect(busdPool.rebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful rebalance should emit `Rebalanced` event", async () => {
      await expect(busdPool.connect(alice).rebalance(0))
        .to.emit(busdPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [50, 25, 25]);
    });

    it("Successful rebalance after change distributions", async () => {
      await busdPool.connect(owner).pause();
      await busdPool.connect(owner).setPoolTokensDistributions([75, 0, 25]);
      await busdPool.connect(owner).unpause();

      expect(await getBalancesOf(busdPool.address)).to.deep.eq(
        await busdPool.poolTokensBalances()
      );

      const { tokenBalances: balancesBefore } = await busdPool.investmentByUser(
        alice.address,
        0
      );

      expect(balancesBefore[1]).to.not.eq(0);

      await expect(busdPool.connect(alice).rebalance(0))
        .to.emit(busdPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [75, 0, 25]);

      const { tokenBalances: balancesAfter } = await busdPool.investmentByUser(
        alice.address,
        0
      );

      expect(balancesAfter[1]).to.eq(0);

      expect(await getBalancesOf(busdPool.address)).to.deep.eq(
        await busdPool.poolTokensBalances()
      );
    });

    it("Trying to execute `toggleRebalance` function with non-exists investment should revert", async () => {
      await expect(busdPool.connect(owner).toggleRebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful `toggleRebalance` should emit `ToggleRebalance` event", async () => {
      await expect(busdPool.connect(alice).toggleRebalance(0))
        .to.emit(busdPool, "ToggleRebalance")
        .withArgs(alice.address, 0, false);

      await expect(busdPool.connect(alice).toggleRebalance(0))
        .to.emit(busdPool, "ToggleRebalance")
        .withArgs(alice.address, 0, true);
    });

    it("Rebalance not works after disable it", async () => {
      await busdPool.connect(alice).toggleRebalance(0);
      expect(
        (await busdPool.investmentByUser(alice.address, 0)).rebalanceEnabled
      ).to.eq(false);

      await expect(busdPool.connect(alice).rebalance(0)).to.revertedWith(
        "rebalance not enabled"
      );
    });
  });
});
