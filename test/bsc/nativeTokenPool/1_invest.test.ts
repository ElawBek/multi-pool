import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";

import { deployBnbPoolFixture, investFixture, getTokens } from "../helpers";

import { Pool, IERC20 } from "../../../typechain-types";

describe("Investment", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let bnbPool: Pool;

  describe("#invest", () => {
    beforeEach(async () => {
      ({ owner, alice, bob, bnbPool } = await loadFixture(
        deployBnbPoolFixture
      ));
    });

    it("Trying to send amount less than the minimum via receive()", async () => {
      await expect(
        owner.sendTransaction({
          to: bnbPool.address,
          value: parseEther("0.01"),
        })
      ).to.revertedWith("amount is too small");
    });

    it("Trying to send amount less than the minimum via invest()", async () => {
      await expect(
        bnbPool.invest(parseEther("0.01"), { value: parseEther("0.01") })
      ).to.revertedWith("amount is too small");
    });

    it("Via invest() msg.value should be eq amount", async () => {
      await expect(
        bnbPool.invest(parseEther("1"), { value: parseEther("2") })
      ).to.revertedWith("wrong value");
    });

    it("Successful invest should emit `Invested` event", async () => {
      await expect(
        bnbPool
          .connect(alice)
          .invest(parseEther("1"), { value: parseEther("1") })
      )
        .to.emit(bnbPool, "Invested")
        .withArgs(alice.address, parseEther("0.9"), anyValue, [50, 25, 25]);
    });

    it("Successful invest should transfer the invest fee to feeAddress", async () => {
      await expect(
        bnbPool
          .connect(alice)
          .invest(parseEther("1"), { value: parseEther("1") })
      ).to.changeEtherBalance(owner, parseEther("0.1"));
    });
  });

  describe("State after investments", () => {
    let weth: IERC20;
    let busd: IERC20;
    let cake: IERC20;

    async function getBalancesOf(address: string) {
      const balances = [];
      balances.push(await weth.balanceOf(address));
      balances.push(await busd.balanceOf(address));
      balances.push(await cake.balanceOf(address));

      return balances;
    }

    beforeEach(async () => {
      ({ owner, alice, bob, bnbPool } = await loadFixture(investFixture));
      ({ weth, busd, cake } = getTokens(owner));
    });

    it("Common state variables", async () => {
      const { totalReceivedCurrency, totalInvestFee, poolTokensBalances } =
        await bnbPool.poolData();

      expect(await getBalancesOf(bnbPool.address)).to.deep.eq(
        poolTokensBalances
      );
      expect(totalReceivedCurrency).to.eq(parseEther("99"));
      expect(totalInvestFee).to.eq(parseEther("11"));
    });

    it("#investmentsByUser", async () => {
      const aliceInvestments = await bnbPool.investmentsByUser(alice.address);
      const bobInvestments = await bnbPool.investmentsByUser(bob.address);

      expect([
        aliceInvestments[0].active,
        bobInvestments[0].active,
        aliceInvestments[0].inputIsNativeToken,
        bobInvestments[0].inputIsNativeToken,
      ]).to.deep.eq([true, true, true, true]);

      expect([
        aliceInvestments[0].receivedCurrency,
        bobInvestments[0].receivedCurrency,
      ]).to.deep.eq([parseEther("90"), parseEther("9")]);
      expect(aliceInvestments[0].tokenBalances).to.not.deep.eq([0, 0, 0]);
      expect(bobInvestments[0].tokenBalances).to.not.deep.eq([0, 0, 0]);
    });

    it("Trying to call investmentByUser() with non-exists investmentId should be reverted with panic code 0x32 - ARRAY_ACCESS_OUT_OF_BOUNDS", async () => {
      await expect(
        bnbPool.connect(owner).investmentByUser(alice.address, 1)
      ).to.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);
    });

    it("#investmentByUser", async () => {
      const aliceInvestment = await bnbPool.investmentByUser(alice.address, 0);
      const bobInvestment = await bnbPool.investmentByUser(bob.address, 0);

      expect([
        aliceInvestment.active,
        bobInvestment.active,
        aliceInvestment.inputIsNativeToken,
        bobInvestment.inputIsNativeToken,
      ]).to.deep.eq([true, true, true, true]);

      expect([
        aliceInvestment.receivedCurrency,
        bobInvestment.receivedCurrency,
      ]).to.deep.eq([parseEther("90"), parseEther("9")]);
      expect(aliceInvestment.tokenBalances).to.not.deep.eq([0, 0, 0]);
      expect(bobInvestment.tokenBalances).to.not.deep.eq([0, 0, 0]);
    });
  });

  describe("Invest after pause", async () => {
    beforeEach(async () => {
      ({ owner, alice, bob, bnbPool } = await loadFixture(
        deployBnbPoolFixture
      ));

      await bnbPool.pause();
    });

    it("Cannot invest via receive() when paused", async () => {
      await expect(
        alice.sendTransaction({ to: bnbPool.address, value: parseEther("1") })
      ).to.revertedWith("Pausable: paused");
    });

    it("Cannot invest via invest() when paused", async () => {
      await expect(
        bnbPool.invest(parseEther("1"), { value: parseEther("1") })
      ).to.revertedWith("Pausable: paused");
    });
  });
});
