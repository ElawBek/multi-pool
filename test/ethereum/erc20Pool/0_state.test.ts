import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { deployDaiPoolFixture, WETH, UNI, DAI } from "../helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { Pool, UniswapV3Exchange } from "../../../typechain-types";

describe("Pool state", () => {
  let daiPool: Pool;
  let uniswapExchange: UniswapV3Exchange;
  let owner: SignerWithAddress;

  beforeEach(async () => {
    ({ owner, daiPool, uniswapExchange } = await loadFixture(
      deployDaiPoolFixture
    ));
  });

  it("state", async () => {
    expect(await daiPool.swapRouter()).to.eq(uniswapExchange.address);
    expect(await daiPool.tokenList()).to.deep.eq([WETH, UNI]);
    expect(await daiPool.entryAsset()).to.eq(DAI);
    expect(await daiPool.poolTokensDistributions()).to.deep.eq([75, 25]);
    expect(await daiPool.poolData()).to.deep.eq([
      owner.address, // owner
      DAI, // entryAsset
      [WETH, UNI], // poolTokens
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
