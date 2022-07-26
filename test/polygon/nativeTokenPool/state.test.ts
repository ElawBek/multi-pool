import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { deployMaticPoolFixture, WETH, USDC, AAVE, WMATIC } from "../helpers";

describe("Pool state", () => {
  it("state", async () => {
    const { owner, maticPool, uniswapExchange } = await loadFixture(
      deployMaticPoolFixture
    );

    expect(await maticPool.swapRouter()).to.eq(uniswapExchange.address);
    expect(await maticPool.tokenList()).to.deep.eq([WETH, USDC, AAVE]);
    expect(await maticPool.entryAsset()).to.eq(WMATIC);
    expect(await maticPool.poolTokensDistributions()).to.deep.eq([50, 25, 25]);
    expect(await maticPool.poolData()).to.deep.eq([
      owner.address, // owner
      WMATIC, // entryAsset
      [WETH, USDC, AAVE], // poolTokens
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
