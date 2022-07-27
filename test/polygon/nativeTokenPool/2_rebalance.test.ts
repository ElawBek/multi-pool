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
  let usdc: IERC20;
  let aave: IERC20;

  let maticPool: Pool;

  async function getBalancesOf(address: string) {
    const balances = [];
    balances.push(await weth.balanceOf(address));
    balances.push(await usdc.balanceOf(address));
    balances.push(await aave.balanceOf(address));

    return balances;
  }

  describe("#rebalance", () => {
    beforeEach(async () => {
      ({ owner, alice, maticPool } = await loadFixture(investFixture));
      ({ usdc, aave, weth } = getTokens(owner));
    });

    it("Non-exists investment", async () => {
      await expect(maticPool.rebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful rebalance should emit `Rebalanced` event", async () => {
      await expect(maticPool.connect(alice).rebalance(0))
        .to.emit(maticPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [50, 25, 25]);
    });

    it("Successful rebalance after change distributions", async () => {
      await maticPool.connect(owner).pause();
      await maticPool.connect(owner).setPoolTokensDistributions([45, 0, 55]);
      await maticPool.connect(owner).unpause();

      expect(await getBalancesOf(maticPool.address)).to.deep.eq(
        await maticPool.poolTokensBalances()
      );

      const { tokenBalances: balancesBefore } =
        await maticPool.investmentByUser(alice.address, 0);

      expect(balancesBefore[1]).to.not.eq(0);

      await expect(maticPool.connect(alice).rebalance(0))
        .to.emit(maticPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [45, 0, 55]);

      const { tokenBalances: balancesAfter } = await maticPool.investmentByUser(
        alice.address,
        0
      );

      expect(balancesAfter[1]).to.eq(0);

      expect(await getBalancesOf(maticPool.address)).to.deep.eq(
        await maticPool.poolTokensBalances()
      );
    });

    it("Trying to execute `toggleRebalance` function with non-exists investment should revert", async () => {
      await expect(maticPool.connect(owner).toggleRebalance(1)).to.revertedWith(
        "invesment non-exists"
      );
    });

    it("Successful `toggleRebalance` should emit `ToggleRebalance` event", async () => {
      await expect(maticPool.connect(alice).toggleRebalance(0))
        .to.emit(maticPool, "ToggleRebalance")
        .withArgs(alice.address, 0, false);
    });

    it("Rebalance not works after disable it", async () => {
      await maticPool.connect(alice).toggleRebalance(0);
      expect(
        (await maticPool.investmentByUser(alice.address, 0)).rebalanceEnabled
      ).to.eq(false);

      await expect(maticPool.connect(alice).rebalance(0)).to.revertedWith(
        "rebalance not enabled"
      );
    });
  });
});
