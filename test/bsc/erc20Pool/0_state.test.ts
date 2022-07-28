import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { deployBusdPoolFixture, WETH, WBNB, BUSD, CAKE } from "../helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { Pool, PancakeExchange } from "../../../typechain-types";

describe("Pool state", () => {
  let busdPool: Pool;
  let pancakeExchange: PancakeExchange;
  let owner: SignerWithAddress;

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
