import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IERC20__factory } from "../../../typechain-types";

export const ROUTER_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
export const QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
export const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
export const WETH = "0x2170Ed0880ac9A755fd29B2688956BD959F933F8";
export const BUSD = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
export const CAKE = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";

export function getTokens(signer: SignerWithAddress) {
  const wbnb = IERC20__factory.connect(WBNB, signer);
  const weth = IERC20__factory.connect(WETH, signer);
  const busd = IERC20__factory.connect(BUSD, signer);
  const cake = IERC20__factory.connect(CAKE, signer);

  return { wbnb, weth, busd, cake };
}
