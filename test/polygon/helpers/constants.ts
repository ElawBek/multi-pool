import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IERC20__factory } from "../../../typechain-types";

export const ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
export const WMATIC = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";

export const WETH = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"; //
export const USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // 500
export const USDT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

export function getTokens(signer: SignerWithAddress) {
  const wmatic = IERC20__factory.connect(WMATIC, signer);
  const weth = IERC20__factory.connect(WETH, signer);
  const usdc = IERC20__factory.connect(USDC, signer);
  const usdt = IERC20__factory.connect(USDT, signer);

  return { wmatic, weth, usdc, usdt };
}

export const USDC_OWNER_FROM_MAINNET =
  "0xB60C61DBb7456f024f9338c739B02Be68e3F545C";
