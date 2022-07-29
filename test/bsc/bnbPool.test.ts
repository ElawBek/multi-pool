import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";

import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";

import {
  deployBnbPoolFixture,
  WETH,
  WBNB,
  BUSD,
  CAKE,
  getTokens,
  investFixture,
  getSwapper,
} from "./helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { Pool, PancakeExchange, IERC20 } from "../../typechain-types";

describe("BUSD - pool", () => {
  let bnbPool: Pool;
  let pancakeExchange: PancakeExchange;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let busd: IERC20;
  let weth: IERC20;
  let cake: IERC20;

  async function getBalancesOf(address: string) {
    const balances = [];
    balances.push(await weth.balanceOf(address));
    balances.push(await busd.balanceOf(address));
    balances.push(await cake.balanceOf(address));

    return balances;
  }

  beforeEach(() => {
    ({ busd, weth, cake } = getTokens(owner));
  });

  describe("State", async () => {
    beforeEach(async () => {
      ({ owner, bnbPool, pancakeExchange } = await loadFixture(
        deployBnbPoolFixture
      ));
    });

    it("state", async () => {
      expect(await bnbPool.swapRouter()).to.eq(pancakeExchange.address);
      expect(await bnbPool.tokenList()).to.deep.eq([WETH, BUSD, CAKE]);
      expect(await bnbPool.entryAsset()).to.eq(WBNB);
      expect(await bnbPool.poolTokensDistributions()).to.deep.eq([50, 25, 25]);
      expect(await bnbPool.poolData()).to.deep.eq([
        owner.address, // owner
        WBNB, // entryAsset
        [WETH, BUSD, CAKE], // poolTokens
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
      await expect(bnbPool.invest(parseEther("0.01"))).to.revertedWith(
        "amount is too small"
      );
    });

    it("Successful invest via receive()", async () => {
      // alice invest 0.9 BNB (0.1 - fee)
      await expect(
        alice.sendTransaction({ to: bnbPool.address, value: parseEther("1") })
      )
        .to.emit(bnbPool, "Invested")
        .withArgs(alice.address, parseEther("0.9"), anyValue, [50, 25, 25]);
    });

    it("Can't be invested via invest without msg.value", async () => {
      await expect(
        bnbPool.connect(alice).invest(parseEther("1"))
      ).to.revertedWith("wrong value");
    });

    it("Successful invest should emit `Invested` event", async () => {
      // alice invest 0.9 BNB (0.1 - fee)
      await expect(
        bnbPool
          .connect(alice)
          .invest(parseEther("1"), { value: parseEther("1") })
      )
        .to.emit(bnbPool, "Invested")
        .withArgs(alice.address, parseEther("0.9"), anyValue, [50, 25, 25]);
    });

    it("Successful invest should transfer the invest fee to feeAddress", async () => {
      // fee - 0.1 BNB
      await expect(
        bnbPool
          .connect(alice)
          .invest(parseEther("1"), { value: parseEther("1") })
      ).to.changeEtherBalance(owner, parseEther("0.1"));
    });

    it("Cannot invest via receive() when paused", async () => {
      await bnbPool.connect(owner).pause();
      expect(await bnbPool.paused()).to.eq(true);

      await expect(
        alice.sendTransaction({ to: bnbPool.address, value: parseEther("1") })
      ).to.revertedWith("Pausable: paused");
    });

    it("Cannot invest via invest() when paused", async () => {
      await bnbPool.connect(owner).pause();
      expect(await bnbPool.paused()).to.eq(true);

      await expect(
        bnbPool.invest(parseEther("1"), { value: parseEther("1") })
      ).to.revertedWith("Pausable: paused");
    });
  });

  describe("State after investments", () => {
    beforeEach(async () => {
      // alice invest 100 BNB
      // bob - 10 BNB
      ({ owner, alice, bob, bnbPool } = await loadFixture(investFixture));
    });

    it("Common state variables", async () => {
      const { totalReceivedCurrency, totalInvestFee, poolTokensBalances } =
        await bnbPool.poolData();

      expect(await getBalancesOf(bnbPool.address)).to.deep.eq(
        poolTokensBalances
      );
      // total bnb in the pool - 99 (110 - 10%)
      expect(totalReceivedCurrency).to.eq(parseEther("99"));
      // total invest fee - 11
      expect(totalInvestFee).to.eq(parseEther("11"));
    });

    it("#investmentsByUser", async () => {
      // bob invest the second investment - 20 bnb
      await bnbPool
        .connect(bob)
        .invest(parseEther("20"), { value: parseEther("20") });

      const bobInvestments = await bnbPool.investmentsByUser(bob.address);

      expect([bobInvestments[0].active, bobInvestments[1].active]).to.deep.eq([
        true,
        true,
      ]);

      expect([
        bobInvestments[0].receivedCurrency,
        bobInvestments[1].receivedCurrency,
      ]).to.deep.eq([parseEther("9"), parseEther("18")]);

      // bob in both investment swapped busd to the every pool token
      expect(bobInvestments[0].tokenBalances).to.not.deep.eq([0, 0, 0]);
      expect(bobInvestments[1].tokenBalances).to.not.deep.eq([0, 0, 0]);
    });

    it("Trying to call investmentByUser() with non-exists investmentId should be reverted with panic code 0x32 - ARRAY_ACCESS_OUT_OF_BOUNDS", async () => {
      await expect(
        bnbPool.connect(owner).investmentByUser(alice.address, 1)
      ).to.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);
    });

    it("#investmentByUser", async () => {
      const aliceInvestment = await bnbPool.investmentByUser(alice.address, 0);

      expect(aliceInvestment.active).to.eq(true);
      expect(aliceInvestment.receivedCurrency).to.eq(parseEther("90"));
      expect(aliceInvestment.tokenBalances).to.not.deep.eq([0, 0, 0]);
    });
  });

  describe("#rebalance", () => {
    beforeEach(async () => {
      ({ owner, alice, bnbPool } = await loadFixture(investFixture));
    });

    it("Non-exists investment", async () => {
      await expect(bnbPool.rebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful rebalance should emit `Rebalanced` event", async () => {
      // rebalance without changes distributions
      await expect(bnbPool.connect(alice).rebalance(0))
        .to.emit(bnbPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [50, 25, 25]);
    });

    it("Successful rebalance after change distributions", async () => {
      await bnbPool.connect(owner).pause();
      // change distributions to [75,0,25]
      await bnbPool.connect(owner).setPoolTokensDistributions([75, 0, 25]);
      await bnbPool.connect(owner).unpause();

      expect(await getBalancesOf(bnbPool.address)).to.deep.eq(
        await bnbPool.poolTokensBalances()
      );

      const { tokenBalances: balancesBefore } = await bnbPool.investmentByUser(
        alice.address,
        0
      );

      // before rebalance the second balance of user is not eq 0
      expect(balancesBefore[1]).to.not.eq(0);

      // rebalance with new distributions
      await expect(bnbPool.connect(alice).rebalance(0))
        .to.emit(bnbPool, "Rebalanced")
        .withArgs(alice.address, 0, anyValue, [75, 0, 25]);

      const {
        tokenBalances: balancesAfter,
        receivedCurrency: aliceInvestCurrency,
      } = await bnbPool.investmentByUser(alice.address, 0);
      const { receivedCurrency: bobInvestCurrency } =
        await bnbPool.investmentByUser(bob.address, 0);

      // after rebalance - totalReceivedCurrency have been changed according to the changes in the rebalance
      expect(aliceInvestCurrency.add(bobInvestCurrency)).to.eq(
        await bnbPool.totalReceivedCurrency()
      );

      // after rebalance the second balance of investment is eq 0
      expect(balancesAfter[1]).to.eq(0);

      // total poolTokensBalances is eq balances of tokens
      expect(await getBalancesOf(bnbPool.address)).to.deep.eq(
        await bnbPool.poolTokensBalances()
      );
    });

    it("Trying to execute `toggleRebalance` function with non-exists investment should revert", async () => {
      await expect(bnbPool.connect(owner).toggleRebalance(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Cannot rebalance when paused", async () => {
      await bnbPool.connect(owner).pause();

      await expect(bnbPool.connect(alice).rebalance(0)).to.revertedWith(
        "Pausable: paused"
      );
    });

    it("Cannot toggleRebalance when paused", async () => {
      await bnbPool.connect(owner).pause();

      await expect(bnbPool.connect(alice).toggleRebalance(0)).to.revertedWith(
        "Pausable: paused"
      );
    });

    it("Successful `toggleRebalance` should emit `ToggleRebalance` event", async () => {
      await expect(bnbPool.connect(alice).toggleRebalance(0))
        .to.emit(bnbPool, "ToggleRebalance")
        .withArgs(alice.address, 0, false);

      await expect(bnbPool.connect(alice).toggleRebalance(0))
        .to.emit(bnbPool, "ToggleRebalance")
        .withArgs(alice.address, 0, true);
    });

    it("Rebalance not works after toggle rebalance to false", async () => {
      await bnbPool.connect(alice).toggleRebalance(0);
      expect(
        (await bnbPool.investmentByUser(alice.address, 0)).rebalanceEnabled
      ).to.eq(false);

      await expect(bnbPool.connect(alice).rebalance(0)).to.revertedWith(
        "rebalance not enabled"
      );
    });
  });

  describe("#withdraw", () => {
    beforeEach(async () => {
      ({ owner, alice, bnbPool } = await loadFixture(investFixture));
    });

    it("Non-exists investment", async () => {
      await expect(bnbPool.connect(owner).withdraw(1)).to.revertedWith(
        "investment non-exists"
      );
    });

    it("Successful withdraw should emit `InvestmentWithdrawal` event", async () => {
      await expect(bnbPool.connect(alice).withdraw(0))
        .to.emit(bnbPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    it("Investment can be withdraw when pool is on pause", async () => {
      await bnbPool.connect(owner).pause();
      expect(await bnbPool.paused()).to.eq(true);

      await expect(bnbPool.connect(alice).withdraw(0))
        .to.emit(bnbPool, "InvestmentWithdrawal")
        .withArgs(alice.address, anyValue, 0);
    });

    describe("Non-active investment", () => {
      beforeEach(async () => {
        await bnbPool.connect(alice).withdraw(0);
      });

      it("The non-active investment cannot be withdraw repeatedly", async () => {
        expect((await bnbPool.investmentByUser(alice.address, 0)).active).to.eq(
          false
        );

        await expect(bnbPool.connect(alice).withdraw(0)).to.revertedWith(
          "investment not active"
        );
      });

      it("Trying to execute `toggleRebalance` function with non-active investment should revert", async () => {
        await expect(bnbPool.connect(alice).toggleRebalance(0)).to.revertedWith(
          "investment not active"
        );
      });

      it("Trying to execute `rebalance` function with non-active investment should revert", async () => {
        await expect(bnbPool.connect(alice).rebalance(0)).to.revertedWith(
          "investment not active"
        );
      });
    });

    describe("Success fee", async () => {
      let wbnb: IERC20;

      beforeEach(async () => {
        ({ wbnb, weth } = getTokens(alice));
      });

      it("SuccessFee", async () => {
        const { pancakeExchangeHelper } = await getSwapper(alice);

        // change the dai price in the pancake
        // after that in the withdraw user will get more bnb
        await pancakeExchangeHelper
          .connect(alice)
          .swap(
            wbnb.address,
            weth.address,
            (await time.latest()) + 1000,
            parseEther("5000"),
            alice.address,
            0,
            true,
            { value: parseEther("5000") }
          );

        await bnbPool.connect(alice).withdraw(0);
        // success fee was paid
        expect((await bnbPool.poolData()).totalSuccessFee).to.not.eq(0);
      });
    });
  });

  describe("Owner actions", () => {
    beforeEach(async () => {
      ({ owner, alice, bnbPool } = await loadFixture(deployBnbPoolFixture));
    });

    describe("#pause & #unpause", () => {
      it("Not owner can't execute", async () => {
        await expect(bnbPool.connect(alice).pause()).to.revertedWith(
          "Ownable: caller is not the owner"
        );

        await expect(bnbPool.connect(alice).unpause()).to.revertedWith(
          "Ownable: caller is not the owner"
        );
      });

      it("Successful pause and unpause should emit `Paused` & `Unpaused` events", async () => {
        await expect(bnbPool.connect(owner).pause())
          .to.emit(bnbPool, "Paused")
          .withArgs(owner.address);

        await expect(bnbPool.connect(owner).unpause())
          .to.emit(bnbPool, "Unpaused")
          .withArgs(owner.address);
      });
    });

    describe("#setFeeAddress", () => {
      it("Not owner can't execute", async () => {
        await expect(
          bnbPool.connect(alice).setFeeAddress(alice.address)
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          bnbPool.connect(owner).setFeeAddress(alice.address)
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change feeAddress to addressZero or same", async () => {
        await bnbPool.connect(owner).pause();

        await expect(
          bnbPool.connect(owner).setFeeAddress(owner.address)
        ).to.revertedWith("this address is already set");

        await expect(
          bnbPool.connect(owner).setFeeAddress(constants.AddressZero)
        ).to.revertedWith("new fee address is address(0)");
      });

      it("Successful setFeeAddress", async () => {
        await bnbPool.connect(owner).pause();

        await bnbPool.connect(owner).setFeeAddress(alice.address);

        expect((await bnbPool.poolData()).feeAddress).to.eq(alice.address);
      });
    });

    describe("#setInvestFee & #setSuccessFee", () => {
      it("Not owner can't execute", async () => {
        await expect(bnbPool.connect(alice).setInvestFee(12)).to.revertedWith(
          "Ownable: caller is not the owner"
        );

        await expect(bnbPool.connect(alice).setSuccessFee(12)).to.revertedWith(
          "Ownable: caller is not the owner"
        );
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(bnbPool.connect(owner).setInvestFee(12)).to.revertedWith(
          "Pausable: not paused"
        );

        await expect(bnbPool.connect(owner).setSuccessFee(12)).to.revertedWith(
          "Pausable: not paused"
        );
      });

      it("Impossible change fee to same", async () => {
        await bnbPool.connect(owner).pause();

        await expect(bnbPool.connect(owner).setInvestFee(10)).to.revertedWith(
          "this fee is already set"
        );

        await expect(bnbPool.connect(owner).setSuccessFee(10)).to.revertedWith(
          "this fee is already set"
        );
      });

      it("Impossible change fee to gt 50", async () => {
        await bnbPool.connect(owner).pause();

        await expect(bnbPool.connect(owner).setInvestFee(51)).to.revertedWith(
          "new invest fee is too big"
        );

        await expect(bnbPool.connect(owner).setSuccessFee(51)).to.revertedWith(
          "new success fee is too big"
        );
      });

      it("Set new fee to 12", async () => {
        await bnbPool.connect(owner).pause();

        await bnbPool.connect(owner).setInvestFee(12);
        await bnbPool.connect(owner).setSuccessFee(12);

        expect((await bnbPool.poolInfo()).successFee).to.eq(12);
        expect((await bnbPool.poolInfo()).investFee).to.eq(12);
      });
    });

    describe("#setMinInvestmentLimit", () => {
      it("Not owner can't execute", async () => {
        await expect(
          bnbPool.connect(alice).setMinInvestmentLimit(12)
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          bnbPool.connect(owner).setMinInvestmentLimit(12)
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change fee to 0", async () => {
        await bnbPool.connect(owner).pause();

        await expect(
          bnbPool.connect(owner).setMinInvestmentLimit(0)
        ).to.revertedWith("new min invest is zero");
      });

      it("Set new _minInvest to 1", async () => {
        await bnbPool.connect(owner).pause();

        await bnbPool.connect(owner).setMinInvestmentLimit(1);
      });
    });

    describe("#setPoolTokensDistributions", () => {
      it("Not owner can't execute", async () => {
        await expect(
          bnbPool.connect(alice).setPoolTokensDistributions([12, 0, 88])
        ).to.revertedWith("Ownable: caller is not the owner");
      });

      it("Impossible change fee when pool is not paused", async () => {
        await expect(
          bnbPool.connect(owner).setPoolTokensDistributions([12, 0, 88])
        ).to.revertedWith("Pausable: not paused");
      });

      it("Impossible change to sum of all distributions is not eq 100", async () => {
        await bnbPool.connect(owner).pause();

        await expect(
          bnbPool.connect(owner).setPoolTokensDistributions([13, 0, 88])
        ).to.revertedWith("distribution must be eq 100");
      });

      it("Set new tokensDistributions", async () => {
        await bnbPool.connect(owner).pause();

        await bnbPool.connect(owner).setPoolTokensDistributions([12, 0, 88]);

        expect((await bnbPool.poolData()).poolDistribution).to.deep.eq([
          12, 0, 88,
        ]);
      });
    });
  });
});
