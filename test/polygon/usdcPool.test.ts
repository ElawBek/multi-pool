import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { constants, BigNumber } from "ethers";

import {
  deployUsdcPoolFixture,
  WETH,
  WMATIC,
  USDC,
  USDT,
  getTokens,
  investUsdcFixture,
} from "./helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { Pool, UniswapV3Exchange, IERC20 } from "../../typechain-types";

describe("USDC - pool", () => {
  let usdcPool: Pool;
  let uniswapExchange: UniswapV3Exchange;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let wmatic: IERC20;
  let weth: IERC20;
  let usdt: IERC20;
  let usdc: IERC20;

  async function getBalancesOf(address: string) {
    const balances = [];
    balances.push(await weth.balanceOf(address));
    balances.push(await wmatic.balanceOf(address));
    balances.push(await usdt.balanceOf(address));

    return balances;
  }

  beforeEach(() => {
    ({ usdt, wmatic, usdc, weth } = getTokens(owner));
  });

  describe("State", async () => {
    beforeEach(async () => {
      ({ owner, usdcPool, uniswapExchange } = await loadFixture(
        deployUsdcPoolFixture
      ));
    });

    it("state", async () => {
      expect(await usdcPool.swapRouter()).to.eq(uniswapExchange.address);
      expect(await usdcPool.tokenList()).to.deep.eq([WETH, WMATIC, USDT]);
      expect(await usdcPool.entryAsset()).to.eq(USDC);
      expect(await usdcPool.poolTokensDistributions()).to.deep.eq([50, 25, 25]);
      expect(await usdcPool.poolData()).to.deep.eq([
        owner.address, // owner
        USDC, // entryAsset
        [WETH, WMATIC, USDT], // poolTokens
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
      ({ owner, alice, bob, usdcPool } = await loadFixture(
        deployUsdcPoolFixture
      ));
    });

    it("Trying to send amount less than the minimum", async () => {
      await expect(
        usdcPool.invest(BigNumber.from(0.01 * 10 ** 6))
      ).to.revertedWith("amount is too small");
    });

    it("Successful invest should emit `Invested` event", async () => {
      // getting approve to pool
      await usdc
        .connect(alice)
        .approve(usdcPool.address, BigNumber.from(10 ** 6));

      // alice invest 0.9 DAI (0.1 - fee)
      await expect(usdcPool.connect(alice).invest(BigNumber.from(10 ** 6)))
        .to.emit(usdcPool, "Invested")
        .withArgs(
          alice.address,
          BigNumber.from(0.9 * 10 ** 6),
          anyValue,
          [50, 25, 25]
        );
    });

    it("Successful invest should transfer the invest fee to feeAddress", async () => {
      // getting approve to pool
      await usdc
        .connect(alice)
        .approve(usdcPool.address, BigNumber.from(10 ** 6));

      // fee - 0.1 DAI
      await expect(
        usdcPool.connect(alice).invest(BigNumber.from(10 ** 6))
      ).to.changeTokenBalance(usdc, owner, BigNumber.from(0.1 * 10 ** 6));
    });

    it("Cannot invest via invest() when paused", async () => {
      await usdcPool.connect(owner).pause();
      expect(await usdcPool.paused()).to.eq(true);

      await expect(usdcPool.invest(BigNumber.from(10 ** 6))).to.revertedWith(
        "Pausable: paused"
      );
    });
  });

  describe("State after investments", () => {
    beforeEach(async () => {
      // alice invest 1000 usdc.
      // bob - 500 usdc.
      ({ owner, alice, bob, usdcPool } = await loadFixture(investUsdcFixture));
    });

    it("Common state variables", async () => {
      const { totalReceivedCurrency, totalInvestFee, poolTokensBalances } =
        await usdcPool.poolData();

      expect(await getBalancesOf(usdcPool.address)).to.deep.eq(
        poolTokensBalances
      );
      // total usdc in the pool - 1350 (1500 - 10%)
      expect(totalReceivedCurrency).to.eq(BigNumber.from(1350 * 10 ** 6));
      // total invest fee - 150
      expect(totalInvestFee).to.eq(BigNumber.from(150 * 10 ** 6));
    });

    it("#investmentsByUser", async () => {
      // bob invest the second investment - 250 usdc
      await usdc
        .connect(bob)
        .approve(usdcPool.address, BigNumber.from(250 * 10 ** 6));
      await usdcPool.connect(bob).invest(BigNumber.from(250 * 10 ** 6));

      const bobInvestments = await usdcPool.investmentsByUser(bob.address);

      expect([bobInvestments[0].active, bobInvestments[1].active]).to.deep.eq([
        true,
        true,
      ]);

      expect([
        bobInvestments[0].receivedCurrency,
        bobInvestments[1].receivedCurrency,
      ]).to.deep.eq([
        BigNumber.from(450 * 10 ** 6),
        BigNumber.from(225 * 10 ** 6),
      ]);

      // bob in both investment swapped usdc to the every pool token
      expect(bobInvestments[0].tokenBalances).to.not.deep.eq([0, 0, 0]);
      expect(bobInvestments[1].tokenBalances).to.not.deep.eq([0, 0, 0]);
    });

    it("Trying to call investmentByUser() with non-exists investmentId should be reverted with panic code 0x32 - ARRAY_ACCESS_OUT_OF_BOUNDS", async () => {
      await expect(
        usdcPool.connect(owner).investmentByUser(alice.address, 1)
      ).to.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);
    });

    it("#investmentByUser", async () => {
      const aliceInvestment = await usdcPool.investmentByUser(alice.address, 0);

      expect(aliceInvestment.active).to.eq(true);
      expect(aliceInvestment.receivedCurrency).to.eq(
        BigNumber.from(900 * 10 ** 6)
      );
      expect(aliceInvestment.tokenBalances).to.not.deep.eq([0, 0, 0]);
    });
  });

  describe("#rebalance", () => {
    beforeEach(async () => {
      ({ owner, alice, usdcPool } = await loadFixture(investUsdcFixture));
    });

    it("Non-exists investment", async () => {
      await expect(usdcPool.rebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful rebalance should emit `Rebalanced` event", async () => {
      // rebalance without changes distributions
      await expect(usdcPool.connect(alice).rebalance(0))
        .to.emit(usdcPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [50, 25, 25]);
    });

    it("Successful rebalance after change distributions", async () => {
      await usdcPool.connect(owner).pause();
      // change distributions to [75,0,25]
      await usdcPool.connect(owner).setPoolTokensDistributions([75, 0, 25]);
      await usdcPool.connect(owner).unpause();

      expect(await getBalancesOf(usdcPool.address)).to.deep.eq(
        await usdcPool.poolTokensBalances()
      );

      const { tokenBalances: balancesBefore } = await usdcPool.investmentByUser(
        alice.address,
        0
      );

      // before rebalance the second balance of user is not eq 0
      expect(balancesBefore[1]).to.not.eq(0);

      // rebalance with new distributions
      await expect(usdcPool.connect(alice).rebalance(0))
        .to.emit(usdcPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [75, 0, 25]);

      const {
        tokenBalances: balancesAfter,
        receivedCurrency: aliceInvestCurrency,
      } = await usdcPool.investmentByUser(alice.address, 0);
      const { receivedCurrency: bobInvestCurrency } =
        await usdcPool.investmentByUser(bob.address, 0);

      // after rebalance - totalReceivedCurrency have been changed according to the changes in the rebalance
      expect(aliceInvestCurrency.add(bobInvestCurrency)).to.eq(
        await usdcPool.totalReceivedCurrency()
      );

      // after rebalance the second balance of investment is eq 0
      expect(balancesAfter[1]).to.eq(0);

      // total poolTokensBalances is eq balances of tokens
      expect(await getBalancesOf(usdcPool.address)).to.deep.eq(
        await usdcPool.poolTokensBalances()
      );
    });

    it("Trying to execute `toggleRebalance` function with non-exists investment should revert", async () => {
      await expect(usdcPool.connect(owner).toggleRebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Cannot rebalance when paused", async () => {
      await usdcPool.connect(owner).pause();

      await expect(usdcPool.connect(alice).rebalance(0)).to.revertedWith(
        "Pausable: paused"
      );
    });

    it("Cannot toggleRebalance when paused", async () => {
      await usdcPool.connect(owner).pause();

      await expect(usdcPool.connect(alice).toggleRebalance(0)).to.revertedWith(
        "Pausable: paused"
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

    it("Rebalance not works after toggle rebalance to false", async () => {
      await usdcPool.connect(alice).toggleRebalance(0);
      expect(
        (await usdcPool.investmentByUser(alice.address, 0)).rebalanceEnabled
      ).to.eq(false);

      await expect(usdcPool.connect(alice).rebalance(0)).to.revertedWith(
        "rebalance not enabled"
      );
    });
  });

  describe("#withdraw", () => {
    beforeEach(async () => {
      ({ owner, alice, usdcPool } = await loadFixture(investUsdcFixture));
    });

    it("Non-exists investment", async () => {
      await expect(usdcPool.connect(owner).withdraw(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful withdraw should emit `InvestmentWithdrawal` event", async () => {
      await expect(usdcPool.connect(alice).withdraw(0))
        .to.emit(usdcPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    it("Investment can be withdraw when pool is on pause", async () => {
      await usdcPool.connect(owner).pause();
      expect(await usdcPool.paused()).to.eq(true);

      await expect(usdcPool.connect(alice).withdraw(0))
        .to.emit(usdcPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    describe("Non-active investment", () => {
      beforeEach(async () => {
        await usdcPool.connect(alice).withdraw(0);
      });

      it("The non-active investment cannot be withdraw repeatedly", async () => {
        expect(
          (await usdcPool.investmentByUser(alice.address, 0)).active
        ).to.eq(false);

        await expect(usdcPool.connect(alice).withdraw(0)).to.revertedWith(
          "investment not active"
        );
      });

      it("Trying to execute `toggleRebalance` function with non-active investment should revert", async () => {
        await expect(
          usdcPool.connect(alice).toggleRebalance(0)
        ).to.revertedWith("investment not active");
      });

      it("Trying to execute `rebalance` function with non-active investment should revert", async () => {
        await expect(usdcPool.connect(alice).rebalance(0)).to.revertedWith(
          "investment not active"
        );
      });
    });
  });

  describe("Owner actions", () => {
    beforeEach(async () => {
      ({ owner, alice, usdcPool } = await loadFixture(deployUsdcPoolFixture));
    });

    describe("#pause & #unpause", () => {
      it("Not owner can't execute", async () => {
        await expect(usdcPool.connect(alice).pause()).to.revertedWith(
          "Ownable: caller is not the owner"
        );

        await expect(usdcPool.connect(alice).unpause()).to.revertedWith(
          "Ownable: caller is not the owner"
        );
      });

      it("Successful pause and unpause should emit `Paused` & `Unpaused` events", async () => {
        await expect(usdcPool.connect(owner).pause())
          .to.emit(usdcPool, "Paused")
          .withArgs(owner.address);

        await expect(usdcPool.connect(owner).unpause())
          .to.emit(usdcPool, "Unpaused")
          .withArgs(owner.address);
      });
    });

    describe("#setFeeAddress", () => {
      it("Not owner can't execute", async () => {
        await expect(
          usdcPool.connect(alice).setFeeAddress(alice.address)
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          usdcPool.connect(owner).setFeeAddress(alice.address)
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change feeAddress to addressZero or same", async () => {
        await usdcPool.connect(owner).pause();

        await expect(
          usdcPool.connect(owner).setFeeAddress(owner.address)
        ).to.revertedWith("this address is already set");

        await expect(
          usdcPool.connect(owner).setFeeAddress(constants.AddressZero)
        ).to.revertedWith("new fee address is address(0)");
      });

      it("Successful setFeeAddress", async () => {
        await usdcPool.connect(owner).pause();

        await usdcPool.connect(owner).setFeeAddress(alice.address);

        expect((await usdcPool.poolData()).feeAddress).to.eq(alice.address);
      });
    });

    describe("#setInvestFee & #setSuccessFee", () => {
      it("Not owner can't execute", async () => {
        await expect(usdcPool.connect(alice).setInvestFee(12)).to.revertedWith(
          "Ownable: caller is not the owner"
        );

        await expect(usdcPool.connect(alice).setSuccessFee(12)).to.revertedWith(
          "Ownable: caller is not the owner"
        );
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(usdcPool.connect(owner).setInvestFee(12)).to.revertedWith(
          "Pausable: not paused"
        );

        await expect(usdcPool.connect(owner).setSuccessFee(12)).to.revertedWith(
          "Pausable: not paused"
        );
      });

      it("Impossible change fee to same", async () => {
        await usdcPool.connect(owner).pause();

        await expect(usdcPool.connect(owner).setInvestFee(10)).to.revertedWith(
          "this fee is already set"
        );

        await expect(usdcPool.connect(owner).setSuccessFee(10)).to.revertedWith(
          "this fee is already set"
        );
      });

      it("Impossible change fee to gt 50", async () => {
        await usdcPool.connect(owner).pause();

        await expect(usdcPool.connect(owner).setInvestFee(51)).to.revertedWith(
          "new invest fee is too big"
        );

        await expect(usdcPool.connect(owner).setSuccessFee(51)).to.revertedWith(
          "new success fee is too big"
        );
      });

      it("Set new fee to 12", async () => {
        await usdcPool.connect(owner).pause();

        await usdcPool.connect(owner).setInvestFee(12);
        await usdcPool.connect(owner).setSuccessFee(12);

        expect((await usdcPool.poolInfo()).successFee).to.eq(12);
        expect((await usdcPool.poolInfo()).investFee).to.eq(12);
      });
    });

    describe("#setMinInvestmentLimit", () => {
      it("Not owner can't execute", async () => {
        await expect(
          usdcPool.connect(alice).setMinInvestmentLimit(12)
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          usdcPool.connect(owner).setMinInvestmentLimit(12)
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change fee to 0", async () => {
        await usdcPool.connect(owner).pause();

        await expect(
          usdcPool.connect(owner).setMinInvestmentLimit(0)
        ).to.revertedWith("new min invest is zero");
      });

      it("Set new _minInvest to 1", async () => {
        await usdcPool.connect(owner).pause();

        await usdcPool.connect(owner).setMinInvestmentLimit(1);
      });
    });

    describe("#setPoolTokensDistributions", () => {
      it("Not owner can't execute", async () => {
        await expect(
          usdcPool.connect(alice).setPoolTokensDistributions([12, 0, 88])
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          usdcPool.connect(owner).setPoolTokensDistributions([12, 0, 88])
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change to sum of all distributions is not eq 100", async () => {
        await usdcPool.connect(owner).pause();

        await expect(
          usdcPool.connect(owner).setPoolTokensDistributions([13, 0, 88])
        ).to.revertedWith("distribution must be eq 100");
      });

      it("Set new tokensDistributions", async () => {
        await usdcPool.connect(owner).pause();

        await usdcPool.connect(owner).setPoolTokensDistributions([12, 0, 88]);

        expect((await usdcPool.poolData()).poolDistribution).to.deep.eq([
          12, 0, 88,
        ]);
      });
    });
  });
});
