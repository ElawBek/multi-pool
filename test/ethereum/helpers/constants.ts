import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IERC20__factory } from "../../../typechain-types";

export const ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
export const QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
export const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
export const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

export const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
export const UNI = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";

export function getTokens(signer: SignerWithAddress) {
  const weth = IERC20__factory.connect(WETH, signer);
  const dai = IERC20__factory.connect(DAI, signer);
  const usdc = IERC20__factory.connect(USDC, signer);
  const uni = IERC20__factory.connect(UNI, signer);

  return { uni, weth, usdc, dai };
}

export const DAI_OWNER_FROM_MAINNET =
  "0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2";
