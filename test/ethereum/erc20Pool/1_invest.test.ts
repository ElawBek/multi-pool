import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";

import { deployDaiPoolFixture, getTokens, investDaiFixture } from "../helpers";

import { IERC20, Pool } from "../../../typechain-types";

describe("Investment", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let dai: IERC20;

  let daiPool: Pool;

  describe("#invest", () => {
    beforeEach(async () => {
      ({ owner, alice, bob, daiPool } = await loadFixture(
        deployDaiPoolFixture
      ));
      ({ dai } = getTokens(owner));
    });

    it("Trying to send amount less than the minimum via invest()", async () => {
      await expect(daiPool.invest(parseEther("0.01"))).to.revertedWith(
        "amount is too small"
      );
    });

    it("Successful invest should emit `Invested` event", async () => {
      await dai.connect(alice).approve(daiPool.address, parseEther("1"));

      await expect(daiPool.connect(alice).invest(parseEther("1")))
        .to.emit(daiPool, "Invested")
        .withArgs(alice.address, parseEther("0.9"), anyValue, [75, 25]);
    });

    it("Successful invest should transfer the invest fee to feeAddress", async () => {
      await dai.connect(alice).approve(daiPool.address, parseEther("1"));

      await expect(
        daiPool.connect(alice).invest(parseEther("1"))
      ).to.changeTokenBalance(dai, owner, parseEther("0.1"));
    });
  });

  describe("State after investments", () => {
    let uni: IERC20;
    let weth: IERC20;

    async function getBalancesOf(address: string) {
      const balances = [];
      balances.push(await weth.balanceOf(address));
      balances.push(await uni.balanceOf(address));

      return balances;
    }

    beforeEach(async () => {
      ({ owner, alice, bob, daiPool } = await loadFixture(investDaiFixture));
      ({ uni, weth } = getTokens(owner));
    });

    it("Common state variables", async () => {
      const { totalReceivedCurrency, totalInvestFee, poolTokensBalances } =
        await daiPool.poolData();

      expect(await getBalancesOf(daiPool.address)).to.deep.eq(
        poolTokensBalances
      );
      expect(totalReceivedCurrency).to.eq(parseEther("1350"));
      expect(totalInvestFee).to.eq(parseEther("150"));
    });

    it("#investmentsByUser", async () => {
      const aliceInvestments = await daiPool.investmentsByUser(alice.address);
      const bobInvestments = await daiPool.investmentsByUser(bob.address);

      expect([
        aliceInvestments[0].active,
        bobInvestments[0].active,
        aliceInvestments[0].inputIsNativeToken,
        bobInvestments[0].inputIsNativeToken,
      ]).to.deep.eq([true, true, false, false]);

      expect([
        aliceInvestments[0].receivedCurrency,
        bobInvestments[0].receivedCurrency,
      ]).to.deep.eq([parseEther("900"), parseEther("450")]);
      expect(aliceInvestments[0].tokenBalances).to.not.deep.eq([0, 0]);
      expect(bobInvestments[0].tokenBalances).to.not.deep.eq([0, 0]);
    });

    it("Trying to call investmentByUser() with non-exists investmentId should be reverted with panic code 0x32 - ARRAY_ACCESS_OUT_OF_BOUNDS", async () => {
      await expect(
        daiPool.connect(owner).investmentByUser(alice.address, 1)
      ).to.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);
    });

    it("#investmentByUser", async () => {
      const aliceInvestment = await daiPool.investmentByUser(alice.address, 0);
      const bobInvestment = await daiPool.investmentByUser(bob.address, 0);

      expect([
        aliceInvestment.active,
        bobInvestment.active,
        aliceInvestment.inputIsNativeToken,
        bobInvestment.inputIsNativeToken,
      ]).to.deep.eq([true, true, false, false]);

      expect([
        aliceInvestment.receivedCurrency,
        bobInvestment.receivedCurrency,
      ]).to.deep.eq([parseEther("900"), parseEther("450")]);
      expect(aliceInvestment.tokenBalances).to.not.deep.eq([0, 0]);
      expect(bobInvestment.tokenBalances).to.not.deep.eq([0, 0]);
    });
  });

  describe("Invest after pause", async () => {
    beforeEach(async () => {
      ({ owner, alice, bob, daiPool } = await loadFixture(
        deployDaiPoolFixture
      ));

      await daiPool.pause();
    });

    it("Cannot invest via invest() when paused", async () => {
      await expect(daiPool.invest(parseEther("1"))).to.revertedWith(
        "Pausable: paused"
      );
    });
  });
});
