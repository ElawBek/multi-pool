import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { getTokens, investUsdcFixture } from "../helpers";

import { Pool, IERC20 } from "../../../typechain-types";

describe("Rebalance", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let weth: IERC20;
  let wmatic: IERC20;

  let usdcPool: Pool;

  async function getBalancesOf(address: string) {
    const balances = [];
    balances.push(await weth.balanceOf(address));
    balances.push(await wmatic.balanceOf(address));

    return balances;
  }

  describe("#rebalance", () => {
    beforeEach(async () => {
      ({ owner, alice, usdcPool } = await loadFixture(investUsdcFixture));
      ({ wmatic, weth } = getTokens(owner));
    });

    it("Non-exists investment", async () => {
      await expect(usdcPool.rebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful rebalance should emit `Rebalanced` event", async () => {
      console.log(await usdcPool.investmentByUser(alice.address, 0));

      await expect(usdcPool.connect(alice).rebalance(0))
        .to.emit(usdcPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [75, 25]);

      console.log(await usdcPool.investmentByUser(alice.address, 0));
    });

    it("Successful rebalance after change distributions", async () => {
      await usdcPool.connect(owner).pause();
      await usdcPool.connect(owner).setPoolTokensDistributions([100, 0]);
      await usdcPool.connect(owner).unpause();

      expect(await getBalancesOf(usdcPool.address)).to.deep.eq(
        await usdcPool.poolTokensBalances()
      );

      const { tokenBalances: balancesBefore } = await usdcPool.investmentByUser(
        alice.address,
        0
      );

      expect(balancesBefore[1]).to.not.eq(0);

      await expect(usdcPool.connect(alice).rebalance(0))
        .to.emit(usdcPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [100, 0]);

      const { tokenBalances: balancesAfter } = await usdcPool.investmentByUser(
        alice.address,
        0
      );

      expect(balancesAfter[1]).to.eq(0);

      expect(await getBalancesOf(usdcPool.address)).to.deep.eq(
        await usdcPool.poolTokensBalances()
      );
    });

    it("Trying to execute `toggleRebalance` function with non-exists investment should revert", async () => {
      await expect(usdcPool.connect(owner).toggleRebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful `toggleRebalance` should emit `ToggleRebalance` event", async () => {
      await expect(usdcPool.connect(alice).toggleRebalance(0))
        .to.emit(usdcPool, "ToggleRebalance")
        .withArgs(alice.address, 0, false);

      await expect(usdcPool.connect(alice).toggleRebalance(0))
        .to.emit(usdcPool, "ToggleRebalance")
        .withArgs(alice.address, 0, true);
    });

    it("Rebalance not works after disable it", async () => {
      await usdcPool.connect(alice).toggleRebalance(0);
      expect(
        (await usdcPool.investmentByUser(alice.address, 0)).rebalanceEnabled
      ).to.eq(false);

      await expect(usdcPool.connect(alice).rebalance(0)).to.revertedWith(
        "rebalance not enabled"
      );
    });
  });
});
