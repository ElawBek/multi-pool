import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { deployUsdcPoolFixture, WETH, USDC, WMATIC } from "../helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { Pool, UniswapV3Exchange } from "../../../typechain-types";

describe("Pool state", () => {
  let usdcPool: Pool;
  let uniswapExchange: UniswapV3Exchange;
  let owner: SignerWithAddress;

  beforeEach(async () => {
    ({ owner, usdcPool, uniswapExchange } = await loadFixture(
      deployUsdcPoolFixture
    ));
  });

  it("state", async () => {
    expect(await usdcPool.swapRouter()).to.eq(uniswapExchange.address);
    expect(await usdcPool.tokenList()).to.deep.eq([WETH, WMATIC]);
    expect(await usdcPool.entryAsset()).to.eq(USDC);
    expect(await usdcPool.poolTokensDistributions()).to.deep.eq([75, 25]);
    expect(await usdcPool.poolData()).to.deep.eq([
      owner.address, // owner
      USDC, // entryAsset
      [WETH, WMATIC], // poolTokens
      [75, 25], // poolDistribution
      [0, 0], // poolTokensBalances
      2, // poolSize
      owner.address, // feeAddress
      10, // investFee
      10, // successFee
      0, // totalReceivedCurrency
      0, // totalSuccessFee
      0, // totalManagerFee
    ]);
  });
});
