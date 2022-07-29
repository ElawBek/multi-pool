import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";

import {
  deployDaiPoolFixture,
  WETH,
  UNI,
  USDC,
  DAI,
  getTokens,
  investDaiFixture,
} from "./helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { Pool, UniswapV3Exchange, IERC20 } from "../../typechain-types";

describe("DAI - pool", () => {
  let daiPool: Pool;
  let uniswapExchange: UniswapV3Exchange;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let dai: IERC20;
  let weth: IERC20;
  let uni: IERC20;
  let usdc: IERC20;

  async function getBalancesOf(address: string) {
    const balances = [];
    balances.push(await weth.balanceOf(address));
    balances.push(await usdc.balanceOf(address));
    balances.push(await uni.balanceOf(address));

    return balances;
  }

  beforeEach(() => {
    ({ dai, uni, usdc, weth } = getTokens(owner));
  });

  describe("State", async () => {
    beforeEach(async () => {
      ({ owner, daiPool, uniswapExchange } = await loadFixture(
        deployDaiPoolFixture
      ));
    });

    it("state", async () => {
      expect(await daiPool.swapRouter()).to.eq(uniswapExchange.address);
      expect(await daiPool.tokenList()).to.deep.eq([WETH, USDC, UNI]);
      expect(await daiPool.entryAsset()).to.eq(DAI);
      expect(await daiPool.poolTokensDistributions()).to.deep.eq([50, 25, 25]);
      expect(await daiPool.poolData()).to.deep.eq([
        owner.address, // owner
        DAI, // entryAsset
        [WETH, USDC, UNI], // poolTokens
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
      ({ owner, alice, bob, daiPool } = await loadFixture(
        deployDaiPoolFixture
      ));
    });

    it("Trying to send amount less than the minimum", async () => {
      await expect(daiPool.invest(parseEther("0.01"))).to.revertedWith(
        "amount is too small"
      );
    });

    it("Successful invest should emit `Invested` event", async () => {
      // getting approve to pool
      await dai.connect(alice).approve(daiPool.address, parseEther("1"));

      // alice invest 0.9 DAI (0.1 - fee)
      await expect(daiPool.connect(alice).invest(parseEther("1")))
        .to.emit(daiPool, "Invested")
        .withArgs(alice.address, parseEther("0.9"), anyValue, [50, 25, 25]);
    });

    it("Successful invest should transfer the invest fee to feeAddress", async () => {
      // getting approve to pool
      await dai.connect(alice).approve(daiPool.address, parseEther("1"));

      // fee - 0.1 DAI
      await expect(
        daiPool.connect(alice).invest(parseEther("1"))
      ).to.changeTokenBalance(dai, owner, parseEther("0.1"));
    });

    it("Cannot invest via invest() when paused", async () => {
      await daiPool.connect(owner).pause();
      expect(await daiPool.paused()).to.eq(true);

      await expect(daiPool.invest(parseEther("1"))).to.revertedWith(
        "Pausable: paused"
      );
    });
  });

  describe("State after investments", () => {
    beforeEach(async () => {
      // alice invest 1000 dai.
      // bob - 500 dai.
      ({ owner, alice, bob, daiPool } = await loadFixture(investDaiFixture));
    });

    it("Common state variables", async () => {
      const { totalReceivedCurrency, totalInvestFee, poolTokensBalances } =
        await daiPool.poolData();

      expect(await getBalancesOf(daiPool.address)).to.deep.eq(
        poolTokensBalances
      );
      // total dai in the pool - 1350 (1500 - 10%)
      expect(totalReceivedCurrency).to.eq(parseEther("1350"));
      // total invest fee - 150
      expect(totalInvestFee).to.eq(parseEther("150"));
    });

    it("#investmentsByUser", async () => {
      // bob invest the second investment - 250 dai
      await dai.connect(bob).approve(daiPool.address, parseEther("250"));
      await daiPool.connect(bob).invest(parseEther("250"));

      const bobInvestments = await daiPool.investmentsByUser(bob.address);

      expect([bobInvestments[0].active, bobInvestments[1].active]).to.deep.eq([
        true,
        true,
      ]);

      expect([
        bobInvestments[0].receivedCurrency,
        bobInvestments[1].receivedCurrency,
      ]).to.deep.eq([parseEther("450"), parseEther("225")]);

      // bob in both investment swapped dai to the every pool token
      expect(bobInvestments[0].tokenBalances).to.not.deep.eq([0, 0, 0]);
      expect(bobInvestments[1].tokenBalances).to.not.deep.eq([0, 0, 0]);
    });

    it("Trying to call investmentByUser() with non-exists investmentId should be reverted with panic code 0x32 - ARRAY_ACCESS_OUT_OF_BOUNDS", async () => {
      await expect(
        daiPool.connect(owner).investmentByUser(alice.address, 1)
      ).to.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);
    });

    it("#investmentByUser", async () => {
      const aliceInvestment = await daiPool.investmentByUser(alice.address, 0);

      expect(aliceInvestment.active).to.eq(true);
      expect(aliceInvestment.receivedCurrency).to.eq(parseEther("900"));
      expect(aliceInvestment.tokenBalances).to.not.deep.eq([0, 0, 0]);
    });
  });

  describe("#rebalance", () => {
    beforeEach(async () => {
      ({ owner, alice, daiPool } = await loadFixture(investDaiFixture));
    });

    it("Non-exists investment", async () => {
      await expect(daiPool.rebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful rebalance should emit `Rebalanced` event", async () => {
      // rebalance without changes distributions
      await expect(daiPool.connect(alice).rebalance(0))
        .to.emit(daiPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [50, 25, 25]);
    });

    it("Successful rebalance after change distributions", async () => {
      await daiPool.connect(owner).pause();
      // change distributions to [75,0,25]
      await daiPool.connect(owner).setPoolTokensDistributions([75, 0, 25]);
      await daiPool.connect(owner).unpause();

      expect(await getBalancesOf(daiPool.address)).to.deep.eq(
        await daiPool.poolTokensBalances()
      );

      const { tokenBalances: balancesBefore } = await daiPool.investmentByUser(
        alice.address,
        0
      );

      // before rebalance the second balance of user is not eq 0
      expect(balancesBefore[1]).to.not.eq(0);

      // rebalance with new distributions
      await expect(daiPool.connect(alice).rebalance(0))
        .to.emit(daiPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [75, 0, 25]);

      const {
        tokenBalances: balancesAfter,
        receivedCurrency: aliceInvestCurrency,
      } = await daiPool.investmentByUser(alice.address, 0);
      const { receivedCurrency: bobInvestCurrency } =
        await daiPool.investmentByUser(bob.address, 0);

      // after rebalance - totalReceivedCurrency have been changed according to the changes in the rebalance
      expect(aliceInvestCurrency.add(bobInvestCurrency)).to.eq(
        await daiPool.totalReceivedCurrency()
      );

      // after rebalance the second balance of investment is eq 0
      expect(balancesAfter[1]).to.eq(0);

      // total poolTokensBalances is eq balances of tokens
      expect(await getBalancesOf(daiPool.address)).to.deep.eq(
        await daiPool.poolTokensBalances()
      );
    });

    it("Trying to execute `toggleRebalance` function with non-exists investment should revert", async () => {
      await expect(daiPool.connect(owner).toggleRebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Cannot rebalance when paused", async () => {
      await daiPool.connect(owner).pause();

      await expect(daiPool.connect(alice).rebalance(0)).to.revertedWith(
        "Pausable: paused"
      );
    });

    it("Cannot toggleRebalance when paused", async () => {
      await daiPool.connect(owner).pause();

      await expect(daiPool.connect(alice).toggleRebalance(0)).to.revertedWith(
        "Pausable: paused"
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

    it("Rebalance not works after toggle rebalance to false", async () => {
      await daiPool.connect(alice).toggleRebalance(0);
      expect(
        (await daiPool.investmentByUser(alice.address, 0)).rebalanceEnabled
      ).to.eq(false);

      await expect(daiPool.connect(alice).rebalance(0)).to.revertedWith(
        "rebalance not enabled"
      );
    });
  });

  describe("#withdraw", () => {
    beforeEach(async () => {
      ({ owner, alice, daiPool } = await loadFixture(investDaiFixture));
    });

    it("Non-exists investment", async () => {
      await expect(daiPool.connect(owner).withdraw(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful withdraw should emit `InvestmentWithdrawal` event", async () => {
      await expect(daiPool.connect(alice).withdraw(0))
        .to.emit(daiPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    it("Investment can be withdraw when pool is on pause", async () => {
      await daiPool.connect(owner).pause();
      expect(await daiPool.paused()).to.eq(true);

      await expect(daiPool.connect(alice).withdraw(0))
        .to.emit(daiPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    describe("Non-active investment", () => {
      beforeEach(async () => {
        await daiPool.connect(alice).withdraw(0);
      });

      it("The non-active investment cannot be withdraw repeatedly", async () => {
        expect((await daiPool.investmentByUser(alice.address, 0)).active).to.eq(
          false
        );

        await expect(daiPool.connect(alice).withdraw(0)).to.revertedWith(
          "investment not active"
        );
      });

      it("Trying to execute `toggleRebalance` function with non-active investment should revert", async () => {
        await expect(daiPool.connect(alice).toggleRebalance(0)).to.revertedWith(
          "investment not active"
        );
      });

      it("Trying to execute `rebalance` function with non-active investment should revert", async () => {
        await expect(daiPool.connect(alice).rebalance(0)).to.revertedWith(
          "investment not active"
        );
      });
    });
  });

  describe("Owner actions", () => {
    beforeEach(async () => {
      ({ owner, alice, daiPool } = await loadFixture(deployDaiPoolFixture));
    });

    describe("#pause & #unpause", () => {
      it("Not owner can't execute", async () => {
        await expect(daiPool.connect(alice).pause()).to.revertedWith(
          "Ownable: caller is not the owner"
        );

        await expect(daiPool.connect(alice).unpause()).to.revertedWith(
          "Ownable: caller is not the owner"
        );
      });

      it("Successful pause and unpause should emit `Paused` & `Unpaused` events", async () => {
        await expect(daiPool.connect(owner).pause())
          .to.emit(daiPool, "Paused")
          .withArgs(owner.address);

        await expect(daiPool.connect(owner).unpause())
          .to.emit(daiPool, "Unpaused")
          .withArgs(owner.address);
      });
    });

    describe("#setFeeAddress", () => {
      it("Not owner can't execute", async () => {
        await expect(
          daiPool.connect(alice).setFeeAddress(alice.address)
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          daiPool.connect(owner).setFeeAddress(alice.address)
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change feeAddress to addressZero or same", async () => {
        await daiPool.connect(owner).pause();

        await expect(
          daiPool.connect(owner).setFeeAddress(owner.address)
        ).to.revertedWith("this address is already set");

        await expect(
          daiPool.connect(owner).setFeeAddress(constants.AddressZero)
        ).to.revertedWith("new fee address is address(0)");
      });

      it("Successful setFeeAddress", async () => {
        await daiPool.connect(owner).pause();

        await daiPool.connect(owner).setFeeAddress(alice.address);

        expect((await daiPool.poolData()).feeAddress).to.eq(alice.address);
      });
    });

    describe("#setInvestFee & #setSuccessFee", () => {
      it("Not owner can't execute", async () => {
        await expect(daiPool.connect(alice).setInvestFee(12)).to.revertedWith(
          "Ownable: caller is not the owner"
        );

        await expect(daiPool.connect(alice).setSuccessFee(12)).to.revertedWith(
          "Ownable: caller is not the owner"
        );
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(daiPool.connect(owner).setInvestFee(12)).to.revertedWith(
          "Pausable: not paused"
        );

        await expect(daiPool.connect(owner).setSuccessFee(12)).to.revertedWith(
          "Pausable: not paused"
        );
      });

      it("Impossible change fee to same", async () => {
        await daiPool.connect(owner).pause();

        await expect(daiPool.connect(owner).setInvestFee(10)).to.revertedWith(
          "this fee is already set"
        );

        await expect(daiPool.connect(owner).setSuccessFee(10)).to.revertedWith(
          "this fee is already set"
        );
      });

      it("Impossible change fee to gt 50", async () => {
        await daiPool.connect(owner).pause();

        await expect(daiPool.connect(owner).setInvestFee(51)).to.revertedWith(
          "new invest fee is too big"
        );

        await expect(daiPool.connect(owner).setSuccessFee(51)).to.revertedWith(
          "new success fee is too big"
        );
      });

      it("Set new fee to 12", async () => {
        await daiPool.connect(owner).pause();

        await daiPool.connect(owner).setInvestFee(12);
        await daiPool.connect(owner).setSuccessFee(12);

        expect((await daiPool.poolInfo()).successFee).to.eq(12);
        expect((await daiPool.poolInfo()).investFee).to.eq(12);
      });
    });

    describe("#setMinInvestmentLimit", () => {
      it("Not owner can't execute", async () => {
        await expect(
          daiPool.connect(alice).setMinInvestmentLimit(12)
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          daiPool.connect(owner).setMinInvestmentLimit(12)
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change fee to 0", async () => {
        await daiPool.connect(owner).pause();

        await expect(
          daiPool.connect(owner).setMinInvestmentLimit(0)
        ).to.revertedWith("new min invest is zero");
      });

      it("Set new _minInvest to 1", async () => {
        await daiPool.connect(owner).pause();

        await daiPool.connect(owner).setMinInvestmentLimit(1);
      });
    });

    describe("#setPoolTokensDistributions", () => {
      it("Not owner can't execute", async () => {
        await expect(
          daiPool.connect(alice).setPoolTokensDistributions([12, 0, 88])
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          daiPool.connect(owner).setPoolTokensDistributions([12, 0, 88])
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change to sum of all distributions is not eq 100", async () => {
        await daiPool.connect(owner).pause();

        await expect(
          daiPool.connect(owner).setPoolTokensDistributions([13, 0, 88])
        ).to.revertedWith("distribution must be eq 100");
      });

      it("Set new tokensDistributions", async () => {
        await daiPool.connect(owner).pause();

        await daiPool.connect(owner).setPoolTokensDistributions([12, 0, 88]);

        expect((await daiPool.poolData()).poolDistribution).to.deep.eq([
          12, 0, 88,
        ]);
      });
    });
  });
});
