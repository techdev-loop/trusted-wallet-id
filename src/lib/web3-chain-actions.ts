import walletRegistryEthAbi from "./WalletRegistry-Eth.json";
import { getActiveEip1193Provider } from "./evm-provider-store";

export type Chain = "ethereum" | "bsc" | "tron" | "solana";

const CHAIN_CONFIGS = {
  ethereum: {
    chainId: "0x1",
    chainName: "Ethereum Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://eth.llamarpc.com"],
    blockExplorerUrls: ["https://etherscan.io"],
  },
  bsc: {
    chainId: "0x38",
    chainName: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://bsc-dataseed.binance.org"],
    blockExplorerUrls: ["https://bscscan.com"],
  },
  tron: {
    chainId: "0x2b6653dc",
    chainName: "Tron",
    nativeCurrency: { name: "TRX", symbol: "TRX", decimals: 18 },
    rpcUrls: ["https://api.trongrid.io"],
    blockExplorerUrls: ["https://tronscan.org"],
  },
  solana: {
    chainId: "0x65",
    chainName: "Solana",
    nativeCurrency: { name: "SOL", symbol: "SOL", decimals: 9 },
    rpcUrls: ["https://mainnet.helius-rpc.com/?api-key=b28260a5-911d-4c82-be0d-5fee03221b7c"],
    blockExplorerUrls: ["https://explorer.solana.com"],
  },
} as const;

const USDT_ADDRESSES: Record<Chain, string> = {
  ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  bsc: "0x55d398326f99059fF775485246999027B3197955",
  tron: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  solana: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
];

function resolveUSDTAddress(chain: Chain, overrideAddress?: string): string {
  const override = overrideAddress?.trim();
  return override || USDT_ADDRESSES[chain];
}

function getInjectedEvmProvider(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).ethereum ?? null;
}

async function getEvmBrowserProvider() {
  const provider = getActiveEip1193Provider() ?? getInjectedEvmProvider();
  if (!provider) throw new Error("EVM wallet is not connected. Connect wallet first.");
  const { ethers } = await import("ethers");
  return new ethers.BrowserProvider(provider as any);
}

async function switchNetworkIfNeeded(chain: "ethereum" | "bsc", provider: any): Promise<void> {
  const targetChainId = CHAIN_CONFIGS[chain].chainId;
  const currentNetwork = await provider.getNetwork();
  const currentHex = `0x${Number(currentNetwork.chainId).toString(16)}`.toLowerCase();
  if (currentHex === targetChainId.toLowerCase()) return;

  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: targetChainId }]);
  } catch {
    await provider.send("wallet_addEthereumChain", [CHAIN_CONFIGS[chain]]);
    await provider.send("wallet_switchEthereumChain", [{ chainId: targetChainId }]);
  }
}

function getInjectedTronWeb(): any {
  if (typeof window === "undefined") return null;
  const win = window as any;
  return (
    win.tronWeb ||
    win.tronLink?.tronWeb ||
    win.trustwallet?.tronLink ||
    win.okxwallet?.tronLink ||
    win.bitkeep?.tronWeb ||
    null
  );
}

function requireInjectedTronWeb(): any {
  const tronWeb = getInjectedTronWeb();
  if (!tronWeb) throw new Error("Tron wallet not found.");
  if (!tronWeb.ready) throw new Error("Tron wallet is not ready.");
  return tronWeb;
}

async function sendTronContractTx(
  contractAddress: string,
  functionSelector: string,
  parameters: Array<{ type: string; value: string }>,
  buildErrorMessage: string
): Promise<string> {
  const tronWeb = requireInjectedTronWeb();
  const tx = await tronWeb.transactionBuilder.triggerSmartContract(
    contractAddress,
    functionSelector,
    {},
    parameters,
    tronWeb.defaultAddress.hex
  );
  if (!tx?.result?.result || !tx.transaction) {
    throw new Error(buildErrorMessage);
  }
  const signedTx = await tronWeb.trx.sign(tx.transaction);
  const broadcastTx = await tronWeb.trx.broadcast(signedTx);
  if (!broadcastTx?.result || !broadcastTx?.txid) {
    throw new Error(`Tron transaction failed: ${broadcastTx?.message || "Unknown error"}`);
  }
  return broadcastTx.txid;
}

export async function getOnchainUSDTBalanceAction(
  chain: Chain,
  walletAddress: string,
  usdtTokenAddress?: string
): Promise<{ rawBalance: bigint; decimals: number; formattedBalance: string }> {
  if (chain === "solana") {
    const { getSolanaUSDTBalance } = await import("./solana");
    const { ethers } = await import("ethers");
    const rawBalance = await getSolanaUSDTBalance(walletAddress);
    const decimals = 6;
    return { rawBalance, decimals, formattedBalance: ethers.formatUnits(rawBalance, decimals) };
  }

  if (chain === "tron") {
    const { TronWeb } = await import("tronweb");
    const { ethers } = await import("ethers");
    const tronWeb = new TronWeb({ fullHost: CHAIN_CONFIGS.tron.rpcUrls[0] });
    const tokenAddress = resolveUSDTAddress("tron", usdtTokenAddress);
    const constantResult = await tronWeb.transactionBuilder.triggerConstantContract(
      tokenAddress,
      "balanceOf(address)",
      {},
      [{ type: "address", value: walletAddress }],
      walletAddress
    );
    if (!constantResult?.result?.result || !constantResult.constant_result?.[0]) {
      throw new Error("Failed to fetch Tron USDT balance");
    }
    const rawBalance = BigInt(`0x${constantResult.constant_result[0]}`);
    const decimals = 6;
    return { rawBalance, decimals, formattedBalance: ethers.formatUnits(rawBalance, decimals) };
  }

  const { ethers } = await import("ethers");
  const tokenAddress = resolveUSDTAddress(chain, usdtTokenAddress);
  const provider = new ethers.JsonRpcProvider(CHAIN_CONFIGS[chain].rpcUrls[0]);
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider) as any;
  const normalizedAddress = walletAddress.toLowerCase();
  const [rawBalance, decimals] = await Promise.all([
    contract.balanceOf(normalizedAddress),
    contract.decimals().catch(() => 6),
  ]);
  return { rawBalance, decimals, formattedBalance: ethers.formatUnits(rawBalance, decimals) };
}

export async function approveUSDTAction(
  chain: Chain,
  spenderAddress: string,
  amount?: bigint,
  usdtTokenAddress?: string
): Promise<string> {
  if (chain === "tron") {
    const usdtAddress = resolveUSDTAddress("tron", usdtTokenAddress);
    const approvalAmount =
      amount?.toString() ??
      "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    return sendTronContractTx(
      usdtAddress,
      "approve(address,uint256)",
      [
        { type: "address", value: spenderAddress },
        { type: "uint256", value: approvalAmount },
      ],
      "Failed to build approve transaction"
    );
  }

  if (chain === "solana") {
    return "solana-no-approve-needed";
  }

  const { ethers } = await import("ethers");
  const provider = await getEvmBrowserProvider();
  await switchNetworkIfNeeded(chain, provider);
  const signer = await provider.getSigner();
  const usdtAddress = resolveUSDTAddress(chain, usdtTokenAddress);
  const contract = new ethers.Contract(usdtAddress, ERC20_ABI, signer) as any;
  const tx = await contract.approve(spenderAddress, amount ?? ethers.MaxUint256);
  await tx.wait();
  return tx.hash;
}

export async function registerWalletViaContractAction(
  chain: Chain,
  contractAddress: string,
  connectedWalletAddress?: string
): Promise<string> {
  if (chain === "tron") {
    return sendTronContractTx(contractAddress, "registerWallet()", [], "Failed to build registerWallet transaction");
  }

  if (chain === "solana") {
    const { getPhantomProvider, registerSolanaWallet } = await import("./solana");
    const injectedProvider = getPhantomProvider();
    const walletAddress =
      connectedWalletAddress?.trim() ||
      (injectedProvider?.publicKey ? injectedProvider.publicKey.toString() : "");
    if (!walletAddress) {
      throw new Error("No connected Solana wallet found.");
    }
    return registerSolanaWallet(walletAddress, contractAddress);
  }

  const { ethers } = await import("ethers");
  const provider = await getEvmBrowserProvider();
  await switchNetworkIfNeeded(chain, provider);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(contractAddress, walletRegistryEthAbi.abi, signer) as any;
  const tx = await contract.registerWallet();
  const receipt = await tx.wait();
  if (!receipt?.hash) throw new Error("Transaction receipt not found");
  return receipt.hash;
}

export async function transferUSDTFromUserWalletAction(
  chain: Chain,
  fromAddress: string,
  toAddress: string,
  amountUsdt: string,
  usdtTokenAddress?: string
): Promise<string> {
  const parsedAmount = Number.parseFloat(amountUsdt);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid USDT amount");
  }

  if (chain === "tron") {
    const usdtAddress = resolveUSDTAddress("tron", usdtTokenAddress);
    const amountInSun = Math.round(parsedAmount * 10 ** 6).toString();
    return sendTronContractTx(
      usdtAddress,
      "transferFrom(address,address,uint256)",
      [
        { type: "address", value: fromAddress },
        { type: "address", value: toAddress },
        { type: "uint256", value: amountInSun },
      ],
      "Failed to build Tron transferFrom transaction"
    );
  }

  if (chain === "solana") {
    throw new Error("transferFrom flow is not supported for Solana.");
  }

  const { ethers } = await import("ethers");
  const provider = await getEvmBrowserProvider();
  await switchNetworkIfNeeded(chain, provider);
  const signer = await provider.getSigner();
  const usdtAddress = resolveUSDTAddress(chain, usdtTokenAddress);
  const contract = new ethers.Contract(usdtAddress, ERC20_ABI, signer) as any;
  const decimals = await contract.decimals();
  const normalizedAmount = ethers.parseUnits(parsedAmount.toString(), decimals);
  const tx = await contract.transferFrom(fromAddress, toAddress, normalizedAmount);
  await tx.wait();
  return tx.hash;
}

export async function withdrawUSDTFromContractAction(
  chain: Chain,
  contractAddress: string,
  toAddress: string,
  amountUsdt: string,
  usdtTokenAddress?: string
): Promise<string> {
  const parsedAmount = Number.parseFloat(amountUsdt);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid USDT amount");
  }

  if (chain === "tron") {
    const amountInSun = Math.round(parsedAmount * 10 ** 6).toString();
    return sendTronContractTx(
      contractAddress,
      "withdrawUSDT(address,uint256)",
      [
        { type: "address", value: toAddress },
        { type: "uint256", value: amountInSun },
      ],
      "Failed to build Tron withdrawal transaction"
    );
  }

  if (chain === "solana") {
    const { withdrawSolanaUSDTFromContract } = await import("./solana");
    return withdrawSolanaUSDTFromContract(contractAddress, toAddress, amountUsdt);
  }

  const { ethers } = await import("ethers");
  const provider = await getEvmBrowserProvider();
  await switchNetworkIfNeeded(chain, provider);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(contractAddress, walletRegistryEthAbi.abi, signer) as any;
  const usdtAddress = resolveUSDTAddress(chain, usdtTokenAddress);
  const usdtContract = new ethers.Contract(usdtAddress, ERC20_ABI, signer) as any;
  const decimals = await usdtContract.decimals();
  const normalizedAmount = ethers.parseUnits(parsedAmount.toString(), decimals);
  const tx = await contract.withdrawUSDT(toAddress, normalizedAmount);
  await tx.wait();
  if (!tx.hash) throw new Error("Transaction hash not found");
  return tx.hash;
}
