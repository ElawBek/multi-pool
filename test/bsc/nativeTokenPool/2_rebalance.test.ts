import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { getTokens, investFixture } from "../helpers";

import { Pool, IERC20 } from "../../../typechain-types";

describe("Rebalance", () => {
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

  describe("#rebalance", () => {
    beforeEach(async () => {
      ({ owner, alice, bnbPool } = await loadFixture(investFixture));
      ({ busd, cake, weth } = getTokens(owner));
    });

    it("Non-exists investment", async () => {
      await expect(bnbPool.rebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful rebalance should emit `Rebalanced` event", async () => {
      await expect(bnbPool.connect(alice).rebalance(0))
        .to.emit(bnbPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [50, 25, 25]);
    });

    it("Successful rebalance after change distributions", async () => {
      await bnbPool.connect(owner).pause();
      await bnbPool.connect(owner).setPoolTokensDistributions([45, 0, 55]);
      await bnbPool.connect(owner).unpause();

      expect(await getBalancesOf(bnbPool.address)).to.deep.eq(
        await bnbPool.poolTokensBalances()
      );

      const { tokenBalances: balancesBefore } = await bnbPool.investmentByUser(
        alice.address,
        0
      );

      expect(balancesBefore[1]).to.not.eq(0);

      await expect(bnbPool.connect(alice).rebalance(0))
        .to.emit(bnbPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [45, 0, 55]);

      const { tokenBalances: balancesAfter } = await bnbPool.investmentByUser(
        alice.address,
        0
      );

      expect(balancesAfter[1]).to.eq(0);

      expect(await getBalancesOf(bnbPool.address)).to.deep.eq(
        await bnbPool.poolTokensBalances()
      );
    });

    it("Trying to execute `toggleRebalance` function with non-exists investment should revert", async () => {
      await expect(bnbPool.connect(owner).toggleRebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful `toggleRebalance` should emit `ToggleRebalance` event", async () => {
      await expect(bnbPool.connect(alice).toggleRebalance(0))
        .to.emit(bnbPool, "ToggleRebalance")
        .withArgs(alice.address, 0, false);
    });

    it("Rebalance not works after disable it", async () => {
      await bnbPool.connect(alice).toggleRebalance(0);
      expect(
        (await bnbPool.investmentByUser(alice.address, 0)).rebalanceEnabled
      ).to.eq(false);

      await expect(bnbPool.connect(alice).rebalance(0)).to.revertedWith(
        "rebalance not enabled"
      );
    });

    it("Cannot rebalance when paused", async () => {
      await bnbPool.connect(owner).pause();

      await expect(bnbPool.connect(alice).rebalance(0)).to.revertedWith(
        "Pausable: paused"
      );
    });

    it("Cannot toggleRebalance when paused", async () => {
      await bnbPool.connect(owner).pause();

      await expect(bnbPool.connect(alice).toggleRebalance(0)).to.revertedWith(
        "Pausable: paused"
      );
    });
  });
});
