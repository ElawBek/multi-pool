import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";

import {
  deployBusdPoolFixture,
  getTokens,
  investBusdFixture,
} from "../helpers";

import { IERC20, Pool } from "../../../typechain-types";

describe("Investment", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let busd: IERC20;

  let busdPool: Pool;

  describe("#invest", () => {
    beforeEach(async () => {
      ({ owner, alice, bob, busdPool } = await loadFixture(
        deployBusdPoolFixture
      ));

      ({ busd } = getTokens(owner));
    });

    it("Trying to send amount less than the minimum via invest()", async () => {
      await expect(busdPool.invest(parseEther("0.01"))).to.revertedWith(
        "amount is too small"
      );
    });

    it("Successful invest should emit `Invested` event", async () => {
      await busd.connect(alice).approve(busdPool.address, parseEther("1"));

      await expect(busdPool.connect(alice).invest(parseEther("1")))
        .to.emit(busdPool, "Invested")
        .withArgs(alice.address, parseEther("0.9"), anyValue, [50, 25, 25]);
    });

    it("Successful invest should transfer the invest fee to feeAddress", async () => {
      await busd.connect(alice).approve(busdPool.address, parseEther("1"));

      await expect(
        busdPool.connect(alice).invest(parseEther("1"))
      ).to.changeTokenBalance(busd, owner, parseEther("0.1"));
    });
  });

  describe("State after investments", () => {
    let weth: IERC20;
    let wbnb: IERC20;
    let cake: IERC20;

    async function getBalancesOf(address: string) {
      const balances = [];
      balances.push(await weth.balanceOf(address));
      balances.push(await wbnb.balanceOf(address));
      balances.push(await cake.balanceOf(address));

      return balances;
    }

    beforeEach(async () => {
      ({ owner, alice, bob, busdPool } = await loadFixture(investBusdFixture));
      ({ wbnb, weth, cake } = getTokens(owner));
    });

    it("Common state variables", async () => {
      const { totalReceivedCurrency, totalInvestFee, poolTokensBalances } =
        await busdPool.poolData();

      expect(await getBalancesOf(busdPool.address)).to.deep.eq(
        poolTokensBalances
      );
      expect(totalReceivedCurrency).to.eq(parseEther("1350"));
      expect(totalInvestFee).to.eq(parseEther("150"));
    });

    it("#investmentsByUser", async () => {
      const aliceInvestments = await busdPool.investmentsByUser(alice.address);
      const bobInvestments = await busdPool.investmentsByUser(bob.address);

      expect([aliceInvestments[0].active, bobInvestments[0].active]).to.deep.eq(
        [true, true]
      );

      expect([
        aliceInvestments[0].receivedCurrency,
        bobInvestments[0].receivedCurrency,
      ]).to.deep.eq([parseEther("900"), parseEther("450")]);
      expect(aliceInvestments[0].tokenBalances).to.not.deep.eq([0, 0, 0]);
      expect(bobInvestments[0].tokenBalances).to.not.deep.eq([0, 0, 0]);
    });

    it("Trying to call investmentByUser() with non-exists investmentId should be reverted with panic code 0x32 - ARRAY_ACCESS_OUT_OF_BOUNDS", async () => {
      await expect(
        busdPool.connect(owner).investmentByUser(alice.address, 1)
      ).to.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);
    });

    it("#investmentByUser", async () => {
      const aliceInvestment = await busdPool.investmentByUser(alice.address, 0);
      const bobInvestment = await busdPool.investmentByUser(bob.address, 0);

      expect([aliceInvestment.active, bobInvestment.active]).to.deep.eq([
        true,
        true,
      ]);

      expect([
        aliceInvestment.receivedCurrency,
        bobInvestment.receivedCurrency,
      ]).to.deep.eq([parseEther("900"), parseEther("450")]);
      expect(aliceInvestment.tokenBalances).to.not.deep.eq([0, 0, 0]);
      expect(bobInvestment.tokenBalances).to.not.deep.eq([0, 0, 0]);
    });
  });

  describe("Invest after pause", async () => {
    beforeEach(async () => {
      ({ owner, alice, bob, busdPool } = await loadFixture(
        deployBusdPoolFixture
      ));

      await busdPool.pause();
    });

    it("Cannot invest via invest() when paused", async () => {
      await expect(busdPool.invest(parseEther("1"))).to.revertedWith(
        "Pausable: paused"
      );
    });
  });
});
