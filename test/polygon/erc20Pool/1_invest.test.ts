import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

import {
  deployUsdcPoolFixture,
  investUsdcFixture,
  getTokens,
} from "../helpers";

import { IERC20, Pool } from "../../../typechain-types";

describe("Investment", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let usdc: IERC20;

  let usdcPool: Pool;

  describe("#invest", () => {
    beforeEach(async () => {
      ({ owner, alice, bob, usdcPool } = await loadFixture(
        deployUsdcPoolFixture
      ));

      ({ usdc } = getTokens(owner));
    });

    it("Trying to send amount less than the minimum via invest()", async () => {
      await expect(
        usdcPool.invest(BigNumber.from(0.01 * 10 ** 6))
      ).to.revertedWith("amount is too small");
    });

    it("Successful invest should emit `Invested` event", async () => {
      await usdc
        .connect(alice)
        .approve(usdcPool.address, BigNumber.from(10 ** 6));

      await expect(usdcPool.connect(alice).invest(BigNumber.from(10 ** 6)))
        .to.emit(usdcPool, "Invested")
        .withArgs(
          alice.address,
          BigNumber.from(0.9 * 10 ** 6),
          anyValue,
          [75, 25]
        );
    });

    it("Successful invest should transfer the invest fee to feeAddress", async () => {
      await usdc
        .connect(alice)
        .approve(usdcPool.address, BigNumber.from(10 ** 6));

      await expect(
        usdcPool.connect(alice).invest(BigNumber.from(10 ** 6))
      ).to.changeTokenBalance(usdc, owner, BigNumber.from(0.1 * 10 ** 6));
    });
  });

  describe("State after investments", () => {
    let weth: IERC20;
    let wmatic: IERC20;

    async function getBalancesOf(address: string) {
      const balances = [];
      balances.push(await weth.balanceOf(address));
      balances.push(await wmatic.balanceOf(address));

      return balances;
    }

    beforeEach(async () => {
      ({ owner, alice, bob, usdcPool } = await loadFixture(investUsdcFixture));
      ({ weth, wmatic } = getTokens(owner));
    });

    it("Common state variables", async () => {
      const { totalReceivedCurrency, totalInvestFee, poolTokensBalances } =
        await usdcPool.poolData();

      expect(await getBalancesOf(usdcPool.address)).to.deep.eq(
        poolTokensBalances
      );
      expect(totalReceivedCurrency).to.eq(BigNumber.from(1350 * 10 ** 6));
      expect(totalInvestFee).to.eq(BigNumber.from(150 * 10 ** 6));
    });

    it("#investmentsByUser", async () => {
      const aliceInvestments = await usdcPool.investmentsByUser(alice.address);
      const bobInvestments = await usdcPool.investmentsByUser(bob.address);

      expect([aliceInvestments[0].active, bobInvestments[0].active]).to.deep.eq(
        [true, true]
      );

      expect([
        aliceInvestments[0].receivedCurrency,
        bobInvestments[0].receivedCurrency,
      ]).to.deep.eq([
        BigNumber.from(900 * 10 ** 6),
        BigNumber.from(450 * 10 ** 6),
      ]);
      expect(aliceInvestments[0].tokenBalances).to.not.deep.eq([0, 0]);
      expect(bobInvestments[0].tokenBalances).to.not.deep.eq([0, 0]);
    });

    it("Trying to call investmentByUser() with non-exists investmentId should be reverted with panic code 0x32 - ARRAY_ACCESS_OUT_OF_BOUNDS", async () => {
      await expect(
        usdcPool.connect(owner).investmentByUser(alice.address, 1)
      ).to.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);
    });

    it("#investmentByUser", async () => {
      const aliceInvestment = await usdcPool.investmentByUser(alice.address, 0);
      const bobInvestment = await usdcPool.investmentByUser(bob.address, 0);

      expect([aliceInvestment.active, bobInvestment.active]).to.deep.eq([
        true,
        true,
      ]);

      expect([
        aliceInvestment.receivedCurrency,
        bobInvestment.receivedCurrency,
      ]).to.deep.eq([
        BigNumber.from(900 * 10 ** 6),
        BigNumber.from(450 * 10 ** 6),
      ]);
      expect(aliceInvestment.tokenBalances).to.not.deep.eq([0, 0]);
      expect(bobInvestment.tokenBalances).to.not.deep.eq([0, 0]);
    });
  });

  describe("Invest after pause", async () => {
    beforeEach(async () => {
      ({ owner, alice, bob, usdcPool } = await loadFixture(
        deployUsdcPoolFixture
      ));

      await usdcPool.pause();
    });

    it("Cannot invest via invest() when paused", async () => {
      await expect(usdcPool.invest(BigNumber.from(10 ** 6))).to.revertedWith(
        "Pausable: paused"
      );
    });
  });
});
