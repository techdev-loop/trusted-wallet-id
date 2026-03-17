import type { WalletConnectionMethod } from "./web3";
import type { Chain } from "./web3-chain-actions";
import {
  approveUSDTAction,
  getOnchainUSDTBalanceAction,
  registerWalletViaContractAction,
  transferUSDTFromUserWalletAction,
  withdrawUSDTFromContractAction,
} from "./web3-chain-actions";

export type { Chain, WalletConnectionMethod };

export async function approveUSDTLazy(
  chain: Chain,
  spenderAddress: string,
  amount: bigint | number | string,
  tokenAddressOverride?: string
) {
  const normalizedAmount = typeof amount === "bigint" ? amount : BigInt(amount.toString());
  return approveUSDTAction(chain, spenderAddress, normalizedAmount, tokenAddressOverride);
}

export async function registerWalletViaContractLazy(
  chain: Chain,
  contractAddress: string,
  walletAddress: string
) {
  return registerWalletViaContractAction(chain, contractAddress, walletAddress);
}

export async function getOnchainUSDTBalanceLazy(
  chain: Chain,
  walletAddress: string,
  tokenAddressOverride?: string
) {
  return getOnchainUSDTBalanceAction(chain, walletAddress, tokenAddressOverride);
}

export async function transferUSDTFromUserWalletLazy(
  chain: Chain,
  fromAddress: string,
  toAddress: string,
  amount: string,
  tokenAddressOverride?: string
) {
  return transferUSDTFromUserWalletAction(chain, fromAddress, toAddress, amount, tokenAddressOverride);
}

export async function withdrawUSDTFromContractLazy(
  chain: Chain,
  contractAddress: string,
  recipientAddress: string,
  amount: string,
  tokenAddressOverride?: string
) {
  return withdrawUSDTFromContractAction(chain, contractAddress, recipientAddress, amount, tokenAddressOverride);
}
