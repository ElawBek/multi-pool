import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { getTokens, investFixture } from "../helpers";

import { Pool, IERC20 } from "../../../typechain-types";

describe("Rebalance", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let dai: IERC20;
  let usdc: IERC20;
  let uni: IERC20;

  let ethPool: Pool;

  async function getBalancesOf(address: string) {
    const balances = [];
    balances.push(await dai.balanceOf(address));
    balances.push(await usdc.balanceOf(address));
    balances.push(await uni.balanceOf(address));

    return balances;
  }

  describe("#rebalance", () => {
    beforeEach(async () => {
      ({ owner, alice, ethPool } = await loadFixture(investFixture));
      ({ usdc, uni, dai } = getTokens(owner));
    });

    it("Non-exists investment", async () => {
      await expect(ethPool.rebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful rebalance should emit `Rebalanced` event", async () => {
      await expect(ethPool.connect(alice).rebalance(0))
        .to.emit(ethPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [50, 25, 25]);
    });

    it("Successful rebalance after change distributions", async () => {
      await ethPool.connect(owner).pause();
      await ethPool.connect(owner).setPoolTokensDistributions([45, 0, 55]);
      await ethPool.connect(owner).unpause();

      expect(await getBalancesOf(ethPool.address)).to.deep.eq(
        await ethPool.poolTokensBalances()
      );

      const { tokenBalances: balancesBefore } = await ethPool.investmentByUser(
        alice.address,
        0
      );

      expect(balancesBefore[1]).to.not.eq(0);

      await expect(ethPool.connect(alice).rebalance(0))
        .to.emit(ethPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [45, 0, 55]);

      const { tokenBalances: balancesAfter } = await ethPool.investmentByUser(
        alice.address,
        0
      );

      expect(balancesAfter[1]).to.eq(0);

      expect(await getBalancesOf(ethPool.address)).to.deep.eq(
        await ethPool.poolTokensBalances()
      );
    });

    it("Trying to execute `toggleRebalance` function with non-exists investment should revert", async () => {
      await expect(ethPool.connect(owner).toggleRebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful `toggleRebalance` should emit `ToggleRebalance` event", async () => {
      await expect(ethPool.connect(alice).toggleRebalance(0))
        .to.emit(ethPool, "ToggleRebalance")
        .withArgs(alice.address, 0, false);
    });

    it("Rebalance not works after disable it", async () => {
      await ethPool.connect(alice).toggleRebalance(0);
      expect(
        (await ethPool.investmentByUser(alice.address, 0)).rebalanceEnabled
      ).to.eq(false);

      await expect(ethPool.connect(alice).rebalance(0)).to.revertedWith(
        "rebalance not enabled"
      );
    });
  });
});
