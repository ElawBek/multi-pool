import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { deployMaticPoolFixture, WETH, USDC, DAI, UNI } from "../helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { Pool, UniswapV3Exchange } from "../../../typechain-types";

describe("Pool state", () => {
  let ethPool: Pool;
  let uniswapExchange: UniswapV3Exchange;
  let owner: SignerWithAddress;

  beforeEach(async () => {
    ({ owner, ethPool, uniswapExchange } = await loadFixture(
      deployMaticPoolFixture
    ));
  });

  it("state", async () => {
    expect(await ethPool.swapRouter()).to.eq(uniswapExchange.address);
    expect(await ethPool.tokenList()).to.deep.eq([DAI, USDC, UNI]);
    expect(await ethPool.entryAsset()).to.eq(WETH);
    expect(await ethPool.poolTokensDistributions()).to.deep.eq([50, 25, 25]);
    expect(await ethPool.poolData()).to.deep.eq([
      owner.address, // owner
      WETH, // entryAsset
      [DAI, USDC, UNI], // poolTokens
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
