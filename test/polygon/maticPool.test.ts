import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";

import {
  deployMaticPoolFixture,
  WETH,
  WMATIC,
  USDC,
  USDT,
  getTokens,
  investFixture,
} from "./helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { Pool, UniswapV3Exchange, IERC20 } from "../../typechain-types";

describe("MATIC - pool", () => {
  let maticPool: Pool;
  let uniswapExchange: UniswapV3Exchange;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let weth: IERC20;
  let usdc: IERC20;
  let usdt: IERC20;

  async function getBalancesOf(address: string) {
    const balances = [];
    balances.push(await weth.balanceOf(address));
    balances.push(await usdc.balanceOf(address));
    balances.push(await usdt.balanceOf(address));

    return balances;
  }

  beforeEach(() => {
    ({ weth, usdc, usdt } = getTokens(owner));
  });

  describe("State", async () => {
    beforeEach(async () => {
      ({ owner, maticPool, uniswapExchange } = await loadFixture(
        deployMaticPoolFixture
      ));
    });

    it("state", async () => {
      expect(await maticPool.swapRouter()).to.eq(uniswapExchange.address);
      expect(await maticPool.tokenList()).to.deep.eq([WETH, USDC, USDT]);
      expect(await maticPool.entryAsset()).to.eq(WMATIC);
      expect(await maticPool.poolTokensDistributions()).to.deep.eq([
        50, 25, 25,
      ]);
      expect(await maticPool.poolData()).to.deep.eq([
        owner.address, // owner
        WMATIC, // entryAsset
        [WETH, USDC, USDT], // poolTokens
        [50, 25, 25], // poolDistribution
        [0, 0, 0], // poolTokensBalances
        3, // poolSize
        owner.address, // feeAddress
        10, // investFee
        10, // successFee
        0, // totalReceivedCurrency
        0, // totalSuccessFee
        0, // totalManagerFee
      ]);
    });
  });

  describe("#invest", () => {
    beforeEach(async () => {
      ({ owner, alice, bob, maticPool } = await loadFixture(
        deployMaticPoolFixture
      ));
    });

    it("Trying to send amount less than the minimum via receive()", async () => {
      await expect(
        owner.sendTransaction({
          to: maticPool.address,
          value: parseEther("0.01"),
        })
      ).to.revertedWith("amount is too small");
    });

    it("Trying to send amount less than the minimum via invest()", async () => {
      await expect(maticPool.invest(parseEther("0.01"))).to.revertedWith(
        "amount is too small"
      );
    });

    it("Successful invest via receive()", async () => {
      // alice invest 0.9 MATIC (0.1 - fee)
      await expect(
        alice.sendTransaction({ to: maticPool.address, value: parseEther("1") })
      )
        .to.emit(maticPool, "Invested")
        .withArgs(alice.address, parseEther("0.9"), anyValue, [50, 25, 25]);
    });

    it("Can't be invested via invest without msg.value", async () => {
      await expect(
        maticPool.connect(alice).invest(parseEther("1"))
      ).to.revertedWith("wrong value");
    });

    it("Successful invest should emit `Invested` event", async () => {
      // alice invest 0.9 MATIC (0.1 - fee)
      await expect(
        maticPool
          .connect(alice)
          .invest(parseEther("1"), { value: parseEther("1") })
      )
        .to.emit(maticPool, "Invested")
        .withArgs(alice.address, parseEther("0.9"), anyValue, [50, 25, 25]);
    });

    it("Successful invest should transfer the invest fee to feeAddress", async () => {
      // fee - 0.1 MATIC
      await expect(
        maticPool
          .connect(alice)
          .invest(parseEther("1"), { value: parseEther("1") })
      ).to.changeEtherBalance(owner, parseEther("0.1"));
    });

    it("Cannot invest via receive() when paused", async () => {
      await maticPool.connect(owner).pause();
      expect(await maticPool.paused()).to.eq(true);

      await expect(
        alice.sendTransaction({ to: maticPool.address, value: parseEther("1") })
      ).to.revertedWith("Pausable: paused");
    });

    it("Cannot invest via invest() when paused", async () => {
      await maticPool.connect(owner).pause();
      expect(await maticPool.paused()).to.eq(true);

      await expect(
        maticPool.invest(parseEther("1"), { value: parseEther("1") })
      ).to.revertedWith("Pausable: paused");
    });
  });

  describe("State after investments", () => {
    beforeEach(async () => {
      // alice invest 100 ETH
      // bob - 10 ETH
      ({ owner, alice, bob, maticPool } = await loadFixture(investFixture));
    });

    it("Common state variables", async () => {
      const { totalReceivedCurrency, totalInvestFee, poolTokensBalances } =
        await maticPool.poolData();

      expect(await getBalancesOf(maticPool.address)).to.deep.eq(
        poolTokensBalances
      );
      // total eth in the pool - 99 (110 - 10%)
      expect(totalReceivedCurrency).to.eq(parseEther("99"));
      // total invest fee - 11
      expect(totalInvestFee).to.eq(parseEther("11"));
    });

    it("#investmentsByUser", async () => {
      // bob invest the second investment - 20 ETH
      await maticPool
        .connect(bob)
        .invest(parseEther("20"), { value: parseEther("20") });

      const bobInvestments = await maticPool.investmentsByUser(bob.address);

      expect([bobInvestments[0].active, bobInvestments[1].active]).to.deep.eq([
        true,
        true,
      ]);

      expect([
        bobInvestments[0].receivedCurrency,
        bobInvestments[1].receivedCurrency,
      ]).to.deep.eq([parseEther("9"), parseEther("18")]);

      // bob in both investment swapped eth to the every pool token
      expect(bobInvestments[0].tokenBalances).to.not.deep.eq([0, 0, 0]);
      expect(bobInvestments[1].tokenBalances).to.not.deep.eq([0, 0, 0]);
    });

    it("Trying to call investmentByUser() with non-exists investmentId should be reverted with panic code 0x32 - ARRAY_ACCESS_OUT_OF_BOUNDS", async () => {
      await expect(
        maticPool.connect(owner).investmentByUser(alice.address, 1)
      ).to.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);
    });

    it("#investmentByUser", async () => {
      const aliceInvestment = await maticPool.investmentByUser(
        alice.address,
        0
      );

      expect(aliceInvestment.active).to.eq(true);
      expect(aliceInvestment.receivedCurrency).to.eq(parseEther("90"));
      expect(aliceInvestment.tokenBalances).to.not.deep.eq([0, 0, 0]);
    });
  });

  describe("#rebalance", () => {
    beforeEach(async () => {
      ({ owner, alice, maticPool } = await loadFixture(investFixture));
    });

    it("Non-exists investment", async () => {
      await expect(maticPool.rebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful rebalance should emit `Rebalanced` event", async () => {
      // rebalance without changes distributions
      const { totalReceivedCurrency: before } = await maticPool.poolData();

      await expect(maticPool.connect(alice).rebalance(0))
        .to.emit(maticPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [50, 25, 25]);

      const { totalReceivedCurrency: after } = await maticPool.poolData();

      expect(after).not.eq(before);
    });

    it("Successful rebalance after change distributions", async () => {
      await maticPool.connect(owner).pause();
      // change distributions to [75,0,25]
      await maticPool.connect(owner).setPoolTokensDistributions([75, 0, 25]);
      await maticPool.connect(owner).unpause();

      expect(await getBalancesOf(maticPool.address)).to.deep.eq(
        await maticPool.poolTokensBalances()
      );

      const { tokenBalances: balancesBefore } =
        await maticPool.investmentByUser(alice.address, 0);

      // before rebalance the second balance of user is not eq 0
      expect(balancesBefore[1]).to.not.eq(0);

      // rebalance with new distributions
      await expect(maticPool.connect(alice).rebalance(0))
        .to.emit(maticPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [75, 0, 25]);

      const {
        tokenBalances: balancesAfter,
        receivedCurrency: aliceInvestCurrency,
      } = await maticPool.investmentByUser(alice.address, 0);
      const { receivedCurrency: bobInvestCurrency } =
        await maticPool.investmentByUser(bob.address, 0);

      // after rebalance - totalReceivedCurrency have been changed according to the changes in the rebalance
      expect(aliceInvestCurrency.add(bobInvestCurrency)).to.eq(
        await maticPool.totalReceivedCurrency()
      );

      // after rebalance the second balance of investment is eq 0
      expect(balancesAfter[1]).to.eq(0);

      // total poolTokensBalances is eq balances of tokens
      expect(await getBalancesOf(maticPool.address)).to.deep.eq(
        await maticPool.poolTokensBalances()
      );
    });

    it("Trying to execute `toggleRebalance` function with non-exists investment should revert", async () => {
      await expect(maticPool.connect(owner).toggleRebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Cannot rebalance when paused", async () => {
      await maticPool.connect(owner).pause();

      await expect(maticPool.connect(alice).rebalance(0)).to.revertedWith(
        "Pausable: paused"
      );
    });

    it("Cannot toggleRebalance when paused", async () => {
      await maticPool.connect(owner).pause();

      await expect(maticPool.connect(alice).toggleRebalance(0)).to.revertedWith(
        "Pausable: paused"
      );
    });

    it("Successful `toggleRebalance` should emit `ToggleRebalance` event", async () => {
      await expect(maticPool.connect(alice).toggleRebalance(0))
        .to.emit(maticPool, "ToggleRebalance")
        .withArgs(alice.address, 0, false);

      await expect(maticPool.connect(alice).toggleRebalance(0))
        .to.emit(maticPool, "ToggleRebalance")
        .withArgs(alice.address, 0, true);
    });

    it("Rebalance not works after toggle rebalance to false", async () => {
      await maticPool.connect(alice).toggleRebalance(0);
      expect(
        (await maticPool.investmentByUser(alice.address, 0)).rebalanceEnabled
      ).to.eq(false);

      await expect(maticPool.connect(alice).rebalance(0)).to.revertedWith(
        "rebalance not enabled"
      );
    });
  });

  describe("#withdraw", () => {
    beforeEach(async () => {
      ({ owner, alice, maticPool } = await loadFixture(investFixture));
    });

    it("Non-exists investment", async () => {
      await expect(maticPool.connect(owner).withdraw(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful withdraw should emit `InvestmentWithdrawal` event", async () => {
      await expect(maticPool.connect(alice).withdraw(0))
        .to.emit(maticPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    it("Investment can be withdraw when pool is on pause", async () => {
      await maticPool.connect(owner).pause();
      expect(await maticPool.paused()).to.eq(true);

      await expect(maticPool.connect(alice).withdraw(0))
        .to.emit(maticPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    describe("Non-active investment", () => {
      beforeEach(async () => {
        await maticPool.connect(alice).withdraw(0);
      });

      it("The non-active investment cannot be withdraw repeatedly", async () => {
        expect(
          (await maticPool.investmentByUser(alice.address, 0)).active
        ).to.eq(false);

        await expect(maticPool.connect(alice).withdraw(0)).to.revertedWith(
          "investment not active"
        );
      });

      it("Trying to execute `toggleRebalance` function with non-active investment should revert", async () => {
        await expect(
          maticPool.connect(alice).toggleRebalance(0)
        ).to.revertedWith("investment not active");
      });

      it("Trying to execute `rebalance` function with non-active investment should revert", async () => {
        await expect(maticPool.connect(alice).rebalance(0)).to.revertedWith(
          "investment not active"
        );
      });
    });
  });

  describe("Owner actions", () => {
    beforeEach(async () => {
      ({ owner, alice, maticPool } = await loadFixture(deployMaticPoolFixture));
    });

    describe("#pause & #unpause", () => {
      it("Not owner can't execute", async () => {
        await expect(maticPool.connect(alice).pause()).to.revertedWith(
          "Ownable: caller is not the owner"
        );

        await expect(maticPool.connect(alice).unpause()).to.revertedWith(
          "Ownable: caller is not the owner"
        );
      });

      it("Successful pause and unpause should emit `Paused` & `Unpaused` events", async () => {
        await expect(maticPool.connect(owner).pause())
          .to.emit(maticPool, "Paused")
          .withArgs(owner.address);

        await expect(maticPool.connect(owner).unpause())
          .to.emit(maticPool, "Unpaused")
          .withArgs(owner.address);
      });
    });

    describe("#setFeeAddress", () => {
      it("Not owner can't execute", async () => {
        await expect(
          maticPool.connect(alice).setFeeAddress(alice.address)
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          maticPool.connect(owner).setFeeAddress(alice.address)
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change feeAddress to addressZero or same", async () => {
        await maticPool.connect(owner).pause();

        await expect(
          maticPool.connect(owner).setFeeAddress(owner.address)
        ).to.revertedWith("this address is already set");

        await expect(
          maticPool.connect(owner).setFeeAddress(constants.AddressZero)
        ).to.revertedWith("new fee address is address(0)");
      });

      it("Successful setFeeAddress", async () => {
        await maticPool.connect(owner).pause();

        await maticPool.connect(owner).setFeeAddress(alice.address);

        expect((await maticPool.poolData()).feeAddress).to.eq(alice.address);
      });
    });

    describe("#setInvestFee & #setSuccessFee", () => {
      it("Not owner can't execute", async () => {
        await expect(maticPool.connect(alice).setInvestFee(12)).to.revertedWith(
          "Ownable: caller is not the owner"
        );

        await expect(
          maticPool.connect(alice).setSuccessFee(12)
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(maticPool.connect(owner).setInvestFee(12)).to.revertedWith(
          "Pausable: not paused"
        );

        await expect(
          maticPool.connect(owner).setSuccessFee(12)
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change fee to same", async () => {
        await maticPool.connect(owner).pause();

        await expect(maticPool.connect(owner).setInvestFee(10)).to.revertedWith(
          "this fee is already set"
        );

        await expect(
          maticPool.connect(owner).setSuccessFee(10)
        ).to.revertedWith("this fee is already set");
      });

      it("Impossible change fee to gt 50", async () => {
        await maticPool.connect(owner).pause();

        await expect(maticPool.connect(owner).setInvestFee(51)).to.revertedWith(
          "new invest fee is too big"
        );

        await expect(
          maticPool.connect(owner).setSuccessFee(51)
        ).to.revertedWith("new success fee is too big");
      });

      it("Set new fee to 12", async () => {
        await maticPool.connect(owner).pause();

        await maticPool.connect(owner).setInvestFee(12);
        await maticPool.connect(owner).setSuccessFee(12);

        expect((await maticPool.poolInfo()).successFee).to.eq(12);
        expect((await maticPool.poolInfo()).investFee).to.eq(12);
      });
    });

    describe("#setMinInvestmentLimit", () => {
      it("Not owner can't execute", async () => {
        await expect(
          maticPool.connect(alice).setMinInvestmentLimit(12)
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          maticPool.connect(owner).setMinInvestmentLimit(12)
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change fee to 0", async () => {
        await maticPool.connect(owner).pause();

        await expect(
          maticPool.connect(owner).setMinInvestmentLimit(0)
        ).to.revertedWith("new min invest is zero");
      });

      it("Set new _minInvest to 1", async () => {
        await maticPool.connect(owner).pause();

        await maticPool.connect(owner).setMinInvestmentLimit(1);
      });
    });

    describe("#setPoolTokensDistributions", () => {
      it("Not owner can't execute", async () => {
        await expect(
          maticPool.connect(alice).setPoolTokensDistributions([12, 0, 88])
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          maticPool.connect(owner).setPoolTokensDistributions([12, 0, 88])
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change to sum of all distributions is not eq 100", async () => {
        await maticPool.connect(owner).pause();

        await expect(
          maticPool.connect(owner).setPoolTokensDistributions([13, 0, 88])
        ).to.revertedWith("distribution must be eq 100");
      });

      it("Set new tokensDistributions", async () => {
        await maticPool.connect(owner).pause();

        await maticPool.connect(owner).setPoolTokensDistributions([12, 0, 88]);

        expect((await maticPool.poolData()).poolDistribution).to.deep.eq([
          12, 0, 88,
        ]);
      });
    });
  });
});
