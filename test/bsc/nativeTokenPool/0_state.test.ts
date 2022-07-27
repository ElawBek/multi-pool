import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { deployBnbPoolFixture, BUSD, CAKE, WBNB, WETH } from "../helpers";

import { Pool, PancakeExchange } from "../../../typechain-types";

describe("Pool state", () => {
  let bnbPool: Pool;
  let pancakeExchange: PancakeExchange;
  let owner: SignerWithAddress;

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
