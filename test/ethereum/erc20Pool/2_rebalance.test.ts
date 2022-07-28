import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { getTokens, investDaiFixture } from "../helpers";

import { Pool, IERC20 } from "../../../typechain-types";

describe("Rebalance", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let weth: IERC20;
  let uni: IERC20;

  let daiPool: Pool;

  async function getBalancesOf(address: string) {
    const balances = [];
    balances.push(await weth.balanceOf(address));
    balances.push(await uni.balanceOf(address));

    return balances;
  }

  describe("#rebalance", () => {
    beforeEach(async () => {
      ({ owner, alice, daiPool } = await loadFixture(investDaiFixture));
      ({ weth, uni } = getTokens(owner));
    });

    it("Non-exists investment", async () => {
      await expect(daiPool.rebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful rebalance should emit `Rebalanced` event", async () => {
      await expect(daiPool.connect(alice).rebalance(0))
        .to.emit(daiPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [75, 25]);
    });

    it("Successful rebalance after change distributions", async () => {
      await daiPool.connect(owner).pause();
      await daiPool.connect(owner).setPoolTokensDistributions([100, 0]);
      await daiPool.connect(owner).unpause();

      expect(await getBalancesOf(daiPool.address)).to.deep.eq(
        await daiPool.poolTokensBalances()
      );

      const { tokenBalances: balancesBefore } = await daiPool.investmentByUser(
        alice.address,
        0
      );

      expect(balancesBefore[1]).to.not.eq(0);

      await expect(daiPool.connect(alice).rebalance(0))
        .to.emit(daiPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [100, 0]);

      const { tokenBalances: balancesAfter } = await daiPool.investmentByUser(
        alice.address,
        0
      );

      expect(balancesAfter[1]).to.eq(0);

      expect(await getBalancesOf(daiPool.address)).to.deep.eq(
        await daiPool.poolTokensBalances()
      );
    });

    it("Trying to execute `toggleRebalance` function with non-exists investment should revert", async () => {
      await expect(daiPool.connect(owner).toggleRebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful `toggleRebalance` should emit `ToggleRebalance` event", async () => {
      await expect(daiPool.connect(alice).toggleRebalance(0))
        .to.emit(daiPool, "ToggleRebalance")
        .withArgs(alice.address, 0, false);

      await expect(daiPool.connect(alice).toggleRebalance(0))
        .to.emit(daiPool, "ToggleRebalance")
        .withArgs(alice.address, 0, true);
    });

    it("Rebalance not works after disable it", async () => {
      await daiPool.connect(alice).toggleRebalance(0);
      expect(
        (await daiPool.investmentByUser(alice.address, 0)).rebalanceEnabled
      ).to.eq(false);

      await expect(daiPool.connect(alice).rebalance(0)).to.revertedWith(
        "rebalance not enabled"
      );
    });
  });
});
