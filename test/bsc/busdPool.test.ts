import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";

import {
  deployBusdPoolFixture,
  WETH,
  WBNB,
  BUSD,
  CAKE,
  getTokens,
  investBusdFixture,
} from "./helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { Pool, PancakeExchange, IERC20 } from "../../typechain-types";

describe("BUSD - pool", () => {
  let busdPool: Pool;
  let pancakeExchange: PancakeExchange;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let busd: IERC20;
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

  beforeEach(() => {
    ({ busd, cake, wbnb, weth } = getTokens(owner));
  });

  describe("State", async () => {
    beforeEach(async () => {
      ({ owner, busdPool, pancakeExchange } = await loadFixture(
        deployBusdPoolFixture
      ));
    });

    it("state", async () => {
      expect(await busdPool.swapRouter()).to.eq(pancakeExchange.address);
      expect(await busdPool.tokenList()).to.deep.eq([WETH, WBNB, CAKE]);
      expect(await busdPool.entryAsset()).to.eq(BUSD);
      expect(await busdPool.poolTokensDistributions()).to.deep.eq([50, 25, 25]);
      expect(await busdPool.poolData()).to.deep.eq([
        owner.address, // owner
        BUSD, // entryAsset
        [WETH, WBNB, CAKE], // poolTokens
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
      ({ owner, alice, bob, busdPool } = await loadFixture(
        deployBusdPoolFixture
      ));
    });

    it("Trying to send amount less than the minimum", async () => {
      await expect(busdPool.invest(parseEther("0.01"))).to.revertedWith(
        "amount is too small"
      );
    });

    it("Successful invest should emit `Invested` event", async () => {
      // getting approve to pool
      await busd.connect(alice).approve(busdPool.address, parseEther("1"));

      // alice invest 0.9 BUSD (0.1 - fee)
      await expect(busdPool.connect(alice).invest(parseEther("1")))
        .to.emit(busdPool, "Invested")
        .withArgs(alice.address, parseEther("0.9"), anyValue, [50, 25, 25]);
    });

    it("Successful invest should transfer the invest fee to feeAddress", async () => {
      // getting approve to pool
      await busd.connect(alice).approve(busdPool.address, parseEther("1"));

      // fee - 0.1 BUSD
      await expect(
        busdPool.connect(alice).invest(parseEther("1"))
      ).to.changeTokenBalance(busd, owner, parseEther("0.1"));
    });

    it("Cannot invest via invest() when paused", async () => {
      await busdPool.connect(owner).pause();
      expect(await busdPool.paused()).to.eq(true);

      await expect(busdPool.invest(parseEther("1"))).to.revertedWith(
        "Pausable: paused"
      );
    });
  });

  describe("State after investments", () => {
    beforeEach(async () => {
      // alice invest 1000 busd
      // bob - 500 busd
      ({ owner, alice, bob, busdPool } = await loadFixture(investBusdFixture));
    });

    it("Common state variables", async () => {
      const { totalReceivedCurrency, totalInvestFee, poolTokensBalances } =
        await busdPool.poolData();

      expect(await getBalancesOf(busdPool.address)).to.deep.eq(
        poolTokensBalances
      );
      // total busd in the pool - 1350 (1500 - 10%)
      expect(totalReceivedCurrency).to.eq(parseEther("1350"));
      // total invest fee - 150
      expect(totalInvestFee).to.eq(parseEther("150"));
    });

    it("#investmentsByUser", async () => {
      // bob invest the second investment - 250 busd
      await busd.connect(bob).approve(busdPool.address, parseEther("250"));
      await busdPool.connect(bob).invest(parseEther("250"));

      const bobInvestments = await busdPool.investmentsByUser(bob.address);

      expect([bobInvestments[0].active, bobInvestments[1].active]).to.deep.eq([
        true,
        true,
      ]);

      expect([
        bobInvestments[0].receivedCurrency,
        bobInvestments[1].receivedCurrency,
      ]).to.deep.eq([parseEther("450"), parseEther("225")]);

      // bob in both investment swapped busd to the every pool token
      expect(bobInvestments[0].tokenBalances).to.not.deep.eq([0, 0, 0]);
      expect(bobInvestments[1].tokenBalances).to.not.deep.eq([0, 0, 0]);
    });

    it("Trying to call investmentByUser() with non-exists investmentId should be reverted with panic code 0x32 - ARRAY_ACCESS_OUT_OF_BOUNDS", async () => {
      await expect(
        busdPool.connect(owner).investmentByUser(alice.address, 1)
      ).to.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);
    });

    it("#investmentByUser", async () => {
      const aliceInvestment = await busdPool.investmentByUser(alice.address, 0);

      expect(aliceInvestment.active).to.eq(true);
      expect(aliceInvestment.receivedCurrency).to.eq(parseEther("900"));
      expect(aliceInvestment.tokenBalances).to.not.deep.eq([0, 0, 0]);
    });
  });

  describe("#rebalance", () => {
    beforeEach(async () => {
      ({ owner, alice, busdPool } = await loadFixture(investBusdFixture));
    });

    it("Non-exists investment", async () => {
      await expect(busdPool.rebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful rebalance should emit `Rebalanced` event", async () => {
      // rebalance without changes distributions
      await expect(busdPool.connect(alice).rebalance(0))
        .to.emit(busdPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [50, 25, 25]);
    });

    it("Successful rebalance after change distributions", async () => {
      await busdPool.connect(owner).pause();
      // change distributions to [75,0,25]
      await busdPool.connect(owner).setPoolTokensDistributions([75, 0, 25]);
      await busdPool.connect(owner).unpause();

      expect(await getBalancesOf(busdPool.address)).to.deep.eq(
        await busdPool.poolTokensBalances()
      );

      const { tokenBalances: balancesBefore } = await busdPool.investmentByUser(
        alice.address,
        0
      );

      // before rebalance the second balance of user is not eq 0
      expect(balancesBefore[1]).to.not.eq(0);

      // rebalance with new distributions
      await expect(busdPool.connect(alice).rebalance(0))
        .to.emit(busdPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [75, 0, 25]);

      const {
        tokenBalances: balancesAfter,
        receivedCurrency: aliceInvestCurrency,
      } = await busdPool.investmentByUser(alice.address, 0);
      const { receivedCurrency: bobInvestCurrency } =
        await busdPool.investmentByUser(bob.address, 0);

      // after rebalance - totalReceivedCurrency have been changed according to the changes in the rebalance
      expect(aliceInvestCurrency.add(bobInvestCurrency)).to.eq(
        await busdPool.totalReceivedCurrency()
      );

      // after rebalance the second balance of investment is eq 0
      expect(balancesAfter[1]).to.eq(0);

      // total poolTokensBalances is eq balances of tokens
      expect(await getBalancesOf(busdPool.address)).to.deep.eq(
        await busdPool.poolTokensBalances()
      );
    });

    it("Trying to execute `toggleRebalance` function with non-exists investment should revert", async () => {
      await expect(busdPool.connect(owner).toggleRebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Cannot rebalance when paused", async () => {
      await busdPool.connect(owner).pause();

      await expect(busdPool.connect(alice).rebalance(0)).to.revertedWith(
        "Pausable: paused"
      );
    });

    it("Cannot toggleRebalance when paused", async () => {
      await busdPool.connect(owner).pause();

      await expect(busdPool.connect(alice).toggleRebalance(0)).to.revertedWith(
        "Pausable: paused"
      );
    });

    it("Successful `toggleRebalance` should emit `ToggleRebalance` event", async () => {
      await expect(busdPool.connect(alice).toggleRebalance(0))
        .to.emit(busdPool, "ToggleRebalance")
        .withArgs(alice.address, 0, false);

      await expect(busdPool.connect(alice).toggleRebalance(0))
        .to.emit(busdPool, "ToggleRebalance")
        .withArgs(alice.address, 0, true);
    });

    it("Rebalance not works after toggle rebalance to false", async () => {
      await busdPool.connect(alice).toggleRebalance(0);
      expect(
        (await busdPool.investmentByUser(alice.address, 0)).rebalanceEnabled
      ).to.eq(false);

      await expect(busdPool.connect(alice).rebalance(0)).to.revertedWith(
        "rebalance not enabled"
      );
    });
  });

  describe("#withdraw", () => {
    beforeEach(async () => {
      ({ owner, alice, busdPool } = await loadFixture(investBusdFixture));
    });

    it("Non-exists investment", async () => {
      await expect(busdPool.connect(owner).withdraw(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful withdraw should emit `InvestmentWithdrawal` event", async () => {
      await expect(busdPool.connect(alice).withdraw(0))
        .to.emit(busdPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    it("Investment can be withdraw when pool is on pause", async () => {
      await busdPool.connect(owner).pause();
      expect(await busdPool.paused()).to.eq(true);

      await expect(busdPool.connect(alice).withdraw(0))
        .to.emit(busdPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    describe("Non-active investment", () => {
      beforeEach(async () => {
        await busdPool.connect(alice).withdraw(0);
      });

      it("The non-active investment cannot be withdraw repeatedly", async () => {
        expect(
          (await busdPool.investmentByUser(alice.address, 0)).active
        ).to.eq(false);

        await expect(busdPool.connect(alice).withdraw(0)).to.revertedWith(
          "investment not active"
        );
      });

      it("Trying to execute `toggleRebalance` function with non-active investment should revert", async () => {
        await expect(
          busdPool.connect(alice).toggleRebalance(0)
        ).to.revertedWith("investment not active");
      });

      it("Trying to execute `rebalance` function with non-active investment should revert", async () => {
        await expect(busdPool.connect(alice).rebalance(0)).to.revertedWith(
          "investment not active"
        );
      });
    });
  });

  describe("Owner actions", () => {
    beforeEach(async () => {
      ({ owner, alice, busdPool } = await loadFixture(deployBusdPoolFixture));
    });

    describe("#pause & #unpause", () => {
      it("Not owner can't execute", async () => {
        await expect(busdPool.connect(alice).pause()).to.revertedWith(
          "Ownable: caller is not the owner"
        );

        await expect(busdPool.connect(alice).unpause()).to.revertedWith(
          "Ownable: caller is not the owner"
        );
      });

      it("Successful pause and unpause should emit `Paused` & `Unpaused` events", async () => {
        await expect(busdPool.connect(owner).pause())
          .to.emit(busdPool, "Paused")
          .withArgs(owner.address);

        await expect(busdPool.connect(owner).unpause())
          .to.emit(busdPool, "Unpaused")
          .withArgs(owner.address);
      });
    });

    describe("#setFeeAddress", () => {
      it("Not owner can't execute", async () => {
        await expect(
          busdPool.connect(alice).setFeeAddress(alice.address)
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          busdPool.connect(owner).setFeeAddress(alice.address)
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change feeAddress to addressZero or same", async () => {
        await busdPool.connect(owner).pause();

        await expect(
          busdPool.connect(owner).setFeeAddress(owner.address)
        ).to.revertedWith("this address is already set");

        await expect(
          busdPool.connect(owner).setFeeAddress(constants.AddressZero)
        ).to.revertedWith("new fee address is address(0)");
      });

      it("Successful setFeeAddress", async () => {
        await busdPool.connect(owner).pause();

        await busdPool.connect(owner).setFeeAddress(alice.address);

        expect((await busdPool.poolData()).feeAddress).to.eq(alice.address);
      });
    });

    describe("#setInvestFee & #setSuccessFee", () => {
      it("Not owner can't execute", async () => {
        await expect(busdPool.connect(alice).setInvestFee(12)).to.revertedWith(
          "Ownable: caller is not the owner"
        );

        await expect(busdPool.connect(alice).setSuccessFee(12)).to.revertedWith(
          "Ownable: caller is not the owner"
        );
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(busdPool.connect(owner).setInvestFee(12)).to.revertedWith(
          "Pausable: not paused"
        );

        await expect(busdPool.connect(owner).setSuccessFee(12)).to.revertedWith(
          "Pausable: not paused"
        );
      });

      it("Impossible change fee to same", async () => {
        await busdPool.connect(owner).pause();

        await expect(busdPool.connect(owner).setInvestFee(10)).to.revertedWith(
          "this fee is already set"
        );

        await expect(busdPool.connect(owner).setSuccessFee(10)).to.revertedWith(
          "this fee is already set"
        );
      });

      it("Impossible change fee to gt 50", async () => {
        await busdPool.connect(owner).pause();

        await expect(busdPool.connect(owner).setInvestFee(51)).to.revertedWith(
          "new invest fee is too big"
        );

        await expect(busdPool.connect(owner).setSuccessFee(51)).to.revertedWith(
          "new success fee is too big"
        );
      });

      it("Set new fee to 12", async () => {
        await busdPool.connect(owner).pause();

        await busdPool.connect(owner).setInvestFee(12);
        await busdPool.connect(owner).setSuccessFee(12);

        expect((await busdPool.poolInfo()).successFee).to.eq(12);
        expect((await busdPool.poolInfo()).investFee).to.eq(12);
      });
    });

    describe("#setMinInvestmentLimit", () => {
      it("Not owner can't execute", async () => {
        await expect(
          busdPool.connect(alice).setMinInvestmentLimit(12)
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          busdPool.connect(owner).setMinInvestmentLimit(12)
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change fee to 0", async () => {
        await busdPool.connect(owner).pause();

        await expect(
          busdPool.connect(owner).setMinInvestmentLimit(0)
        ).to.revertedWith("new min invest is zero");
      });

      it("Set new _minInvest to 1", async () => {
        await busdPool.connect(owner).pause();

        await busdPool.connect(owner).setMinInvestmentLimit(1);
      });
    });

    describe("#setPoolTokensDistributions", () => {
      it("Not owner can't execute", async () => {
        await expect(
          busdPool.connect(alice).setPoolTokensDistributions([12, 0, 88])
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          busdPool.connect(owner).setPoolTokensDistributions([12, 0, 88])
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change to sum of all distributions is not eq 100", async () => {
        await busdPool.connect(owner).pause();

        await expect(
          busdPool.connect(owner).setPoolTokensDistributions([13, 0, 88])
        ).to.revertedWith("distribution must be eq 100");
      });

      it("Set new tokensDistributions", async () => {
        await busdPool.connect(owner).pause();

        await busdPool.connect(owner).setPoolTokensDistributions([12, 0, 88]);

        expect((await busdPool.poolData()).poolDistribution).to.deep.eq([
          12, 0, 88,
        ]);
      });
    });
  });
});
