import { Connection, PublicKey, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction, getAccount, getMint } from '@solana/spl-token';
import type { Chain } from './web3';
import SOLANA_PROGRAM_IDL_JSON from './solana-idl.json';

export const SOLANA_PROGRAM_ID = new PublicKey(SOLANA_PROGRAM_IDL_JSON.address);

const DEFAULT_REGISTRY_ACCOUNT = new PublicKey('DwrJcymdTGdiuHK9boV8MPtDmUqMTwzfyvDB8hePMNG4');
const DEFAULT_REGISTRY_USDT_ACCOUNT = new PublicKey('BUwk7UTu536jRaivoLisVkxoZ6M1tnTLHjoaKwDUmgqi');

const SOLANA_PROGRAM_IDL = (() => {
  const idl = JSON.parse(JSON.stringify(SOLANA_PROGRAM_IDL_JSON));
  if (!idl.address) {
    idl.address = SOLANA_PROGRAM_ID.toBase58();
  }
  return idl;
})();

// Solana RPC URL - can be overridden via environment variable
// Defaults to mainnet, but can be set to devnet via VITE_SOLANA_RPC_URL
const SOLANA_RPC = import.meta.env.VITE_SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=b28260a5-911d-4c82-be0d-5fee03221b7c';

// USDT mint address on Solana devnet (fallback, but mainnet address comes from backend config)
export const SOLANA_DEVNET_USDT_MINT = new PublicKey('Ch9MipiMpaZBkCZFPTsArZigDwEH85Yodp2RcPjSmsvr');

/**
 * Get Solana connection
 * Uses mainnet by default, but can be overridden via VITE_SOLANA_RPC_URL environment variable
 * Uses 'confirmed' commitment for better reliability on production
 */
export function getSolanaConnection(): Connection {
  const connection = new Connection(SOLANA_RPC, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000, // 60 seconds timeout
  });
  return connection;
}

/**
 * Get Phantom wallet provider
 */
export function getPhantomProvider() {
  if (typeof window === 'undefined') {
    return null;
  }
  const win = window as any;
  return win.phantom?.solana || null;
}

/**
 * Get Solana Anchor provider
 */
export async function getSolanaProvider(): Promise<AnchorProvider | null> {
  const provider = getPhantomProvider();
  if (!provider || !provider.publicKey) {
    return null;
  }

  const connection = getSolanaConnection();
  
  // Handle both PublicKey object and string
  const publicKey = provider.publicKey instanceof PublicKey 
    ? provider.publicKey 
    : new PublicKey(provider.publicKey.toString());
  
  const wallet = {
    publicKey,
    signTransaction: async (tx: Transaction) => {
      const signed = await provider.signTransaction(tx);
      return signed;
    },
    signAllTransactions: async (txs: Transaction[]) => {
      const signed = await provider.signAllTransactions(txs);
      return signed;
    },
  } as Wallet;

  return new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
}

export async function getSolanaProgram() {
  const provider = await getSolanaProvider();
  if (!provider) {
    throw new Error('Phantom wallet not connected');
  }
  return new Program(SOLANA_PROGRAM_IDL as any, provider);
}

export function getDefaultRegistryAccount(): PublicKey {
  return DEFAULT_REGISTRY_ACCOUNT;
}

/**
 * Get registry USDT account PDA (for the token account)
 * Note: This function derives the PDA, but we use DEFAULT_REGISTRY_USDT_ACCOUNT directly
 */
export function getRegistryUsdtAccountPDA(usdtMint: PublicKey): PublicKey {
  // Use TextEncoder for browser compatibility (no Buffer)
  const registryBytes = new TextEncoder().encode('registry');
  const [pda] = PublicKey.findProgramAddressSync(
    [registryBytes, usdtMint.toBuffer()],
    SOLANA_PROGRAM_ID
  );
  return pda;
}

/**
 * Get the default registry USDT token account address
 */
export function getDefaultRegistryUsdtAccount(): PublicKey {
  return DEFAULT_REGISTRY_USDT_ACCOUNT;
}

export async function initializeSolanaRegistry(ownerAddress: string, registryAddress?: string): Promise<string> {
  try {
    console.log('[initializeSolanaRegistry] Starting registry initialization...');
    
    const provider = await getSolanaProvider();
    if (!provider) {
      throw new Error('Phantom wallet not connected');
    }
    
    const program = await getSolanaProgram();
    const connection = getSolanaConnection();
    const ownerPubkey = new PublicKey(ownerAddress);
    const usdtMint = SOLANA_DEVNET_USDT_MINT;
    
    const registryPubkey = registryAddress ? new PublicKey(registryAddress) : getDefaultRegistryAccount();
    
    console.log('[initializeSolanaRegistry] Registry account:', registryPubkey.toString());
    console.log('[initializeSolanaRegistry] Owner:', ownerPubkey.toString());
    console.log('[initializeSolanaRegistry] USDT Mint:', usdtMint.toString());
    
    const registryInfo = await connection.getAccountInfo(registryPubkey);
    if (registryInfo) {
      console.log('[initializeSolanaRegistry] Registry already exists!');
      return registryPubkey.toString();
    }
    
    if (!registryAddress) {
      throw new Error('Registry account must be provided. The registry is a regular account, not a PDA.');
    }
    
    const tx = await program.methods
      .initialize(usdtMint)
      .accounts({
        registry: registryPubkey,
        owner: ownerPubkey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log('[initializeSolanaRegistry] Registry initialized successfully!');
    console.log('[initializeSolanaRegistry] Transaction:', tx);
    console.log('[initializeSolanaRegistry] Registry account address:', registryPubkey.toString());
    
    return registryPubkey.toString();
  } catch (error: any) {
    console.error('[initializeSolanaRegistry] Failed to initialize registry:', error);
    if (error?.code === 4001 || error?.message?.includes('User rejected')) {
      throw new Error('User rejected the transaction');
    }
    throw new Error(`Failed to initialize registry: ${error?.message || String(error)}`);
  }
}

/**
 * Initialize the registry USDT token account (PDA)
 * This must be called after the registry is initialized
 */
export async function initializeRegistryUsdtAccount(ownerAddress: string, registryAddress?: string): Promise<string> {
  try {
    console.log('[initializeRegistryUsdtAccount] Starting registry USDT account initialization...');
    
    const provider = await getSolanaProvider();
    if (!provider) {
      throw new Error('Phantom wallet not connected');
    }
    
    const program = await getSolanaProgram();
    const connection = getSolanaConnection();
    const ownerPubkey = new PublicKey(ownerAddress);
    const usdtMint = SOLANA_DEVNET_USDT_MINT;
    
    const registryPubkey = registryAddress ? new PublicKey(registryAddress) : getDefaultRegistryAccount();
    
    console.log('[initializeRegistryUsdtAccount] Registry account:', registryPubkey.toString());
    console.log('[initializeRegistryUsdtAccount] Owner:', ownerPubkey.toString());
    console.log('[initializeRegistryUsdtAccount] USDT Mint:', usdtMint.toString());
    
    // Derive the registry USDT account PDA
    const registryUsdtAccountPDA = getRegistryUsdtAccountPDA(usdtMint);
    console.log('[initializeRegistryUsdtAccount] Registry USDT account PDA:', registryUsdtAccountPDA.toString());
    
    // Check if it already exists
    try {
      await getAccount(connection, registryUsdtAccountPDA, 'confirmed', TOKEN_PROGRAM_ID);
      console.log('[initializeRegistryUsdtAccount] Registry USDT account already exists!');
      return registryUsdtAccountPDA.toString();
    } catch (error: any) {
      if (error?.name !== 'TokenAccountNotFoundError') {
        throw error;
      }
      console.log('[initializeRegistryUsdtAccount] Registry USDT account does not exist, initializing...');
    }
    
    // Call initialize_registry_usdt_account (camelCase for Anchor 0.32)
    const tx = await program.methods
      .initializeRegistryUsdtAccount()
      .accounts({
        registry: registryPubkey,
        owner: ownerPubkey,
        usdtMint: usdtMint,
        registryUsdtAccount: registryUsdtAccountPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log('[initializeRegistryUsdtAccount] Registry USDT account initialized successfully!');
    console.log('[initializeRegistryUsdtAccount] Transaction:', tx);
    console.log('[initializeRegistryUsdtAccount] Registry USDT account address:', registryUsdtAccountPDA.toString());
    
    return registryUsdtAccountPDA.toString();
  } catch (error: any) {
    console.error('[initializeRegistryUsdtAccount] Failed to initialize registry USDT account:', error);
    if (error?.code === 4001 || error?.message?.includes('User rejected')) {
      throw new Error('User rejected the transaction');
    }
    throw new Error(`Failed to initialize registry USDT account: ${error?.message || String(error)}`);
  }
}

export async function isSolanaWalletVerified(walletAddress: string, registryAddress?: string): Promise<boolean> {
  try {
    const program = await getSolanaProgram();
    const walletPubkey = new PublicKey(walletAddress);
    const registryPubkey = registryAddress ? new PublicKey(registryAddress) : getDefaultRegistryAccount();

    const result = await program.methods
      .isWalletVerified()
      .accounts({
        registry: registryPubkey,
        wallet: walletPubkey,
      })
      .view();

    return result as boolean;
  } catch (error) {
    console.error('Error checking Solana wallet verification:', error);
    return false;
  }
}

/**
 * Get USDT balance on Solana
 */
export async function getSolanaUSDTBalance(address: string): Promise<bigint> {
  try {
    const connection = getSolanaConnection();
    const walletPubkey = new PublicKey(address);
    const usdtMint = SOLANA_DEVNET_USDT_MINT;

    const tokenAccount = await getAssociatedTokenAddress(
      usdtMint,
      walletPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    try {
      const accountInfo = await getAccount(connection, tokenAccount, 'confirmed', TOKEN_PROGRAM_ID);
      return BigInt(accountInfo.amount.toString());
    } catch (error: any) {
      if (error?.name === 'TokenAccountNotFoundError') {
        return BigInt(0);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error getting Solana USDT balance:', error);
    throw error;
  }
}

/**
 * Transfer USDT on Solana (SPL token transfer).
 */
export async function transferSolanaUSDT(toAddress: string, amountUsdt: string): Promise<string> {
  const phantomProvider = getPhantomProvider();
  if (!phantomProvider || !phantomProvider.publicKey) {
    throw new Error("Phantom wallet is not connected");
  }

  const connection = getSolanaConnection();
  const fromPubkey = new PublicKey(phantomProvider.publicKey.toString());
  const toPubkey = new PublicKey(toAddress);
  const usdtMint = SOLANA_DEVNET_USDT_MINT;

  const mintInfo = await getMint(connection, usdtMint, "confirmed", TOKEN_PROGRAM_ID);
  const parsedAmount = Number.parseFloat(amountUsdt);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid USDT amount");
  }
  const amountRaw = BigInt(Math.round(parsedAmount * 10 ** mintInfo.decimals));

  const fromTokenAccount = await getAssociatedTokenAddress(
    usdtMint,
    fromPubkey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Ensure sender token account exists and has enough funds.
  const fromAccountInfo = await getAccount(connection, fromTokenAccount, "confirmed", TOKEN_PROGRAM_ID);
  if (BigInt(fromAccountInfo.amount.toString()) < amountRaw) {
    throw new Error("Insufficient Solana USDT balance");
  }

  const toTokenAccount = await getAssociatedTokenAddress(
    usdtMint,
    toPubkey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction();

  // Create destination ATA if it doesn't exist.
  try {
    await getAccount(connection, toTokenAccount, "confirmed", TOKEN_PROGRAM_ID);
  } catch (error: any) {
    if (error?.name === "TokenAccountNotFoundError") {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromPubkey,
          toTokenAccount,
          toPubkey,
          usdtMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    } else {
      throw error;
    }
  }

  transaction.add(
    createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      fromPubkey,
      amountRaw,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = fromPubkey;
  transaction.recentBlockhash = latestBlockhash.blockhash;

  const signedTransaction = await phantomProvider.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
    skipPreflight: false,
    maxRetries: 3
  });

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    },
    "confirmed"
  );

  return signature;
}

/**
 * Withdraw USDT from Solana WalletRegistry contract (admin function)
 * @param registryAddress - The registry account address
 * @param recipientAddress - The address to receive the USDT
 * @param amountUsdt - The amount of USDT to withdraw (as a string, e.g., "10.5")
 */
export async function withdrawSolanaUSDTFromContract(
  registryAddress: string,
  recipientAddress: string,
  amountUsdt: string
): Promise<string> {
  const phantomProvider = getPhantomProvider();
  if (!phantomProvider || !phantomProvider.publicKey) {
    throw new Error("Phantom wallet is not connected");
  }

  const connection = getSolanaConnection();
  const program = await getSolanaProgram();
  const ownerPubkey = new PublicKey(phantomProvider.publicKey.toString());
  
  // Use the correct registry account (same as registration)
  // The backend might return an old registry address, so we use the correct one
  const correctRegistryAddress = DEFAULT_REGISTRY_ACCOUNT.toString();
  let registryPubkey: PublicKey;
  
  if (registryAddress && registryAddress !== correctRegistryAddress) {
    console.warn(`[withdrawSolanaUSDTFromContract] WARNING: Backend returned old registry address: ${registryAddress}`);
    console.warn(`[withdrawSolanaUSDTFromContract] Using correct registry account: ${correctRegistryAddress}`);
    registryPubkey = DEFAULT_REGISTRY_ACCOUNT;
  } else {
    registryPubkey = DEFAULT_REGISTRY_ACCOUNT;
  }
  
  console.log('[withdrawSolanaUSDTFromContract] Using registry address:', registryPubkey.toString());
  console.log('[withdrawSolanaUSDTFromContract] Program ID:', SOLANA_PROGRAM_ID.toString());
  
  const recipientPubkey = new PublicKey(recipientAddress);
  const usdtMint = SOLANA_DEVNET_USDT_MINT;

  // Validate that the registry account is owned by the correct program
  try {
    const registryAccountInfo = await connection.getAccountInfo(registryPubkey, "confirmed");
    if (!registryAccountInfo) {
      throw new Error(
        `Registry account not found: ${registryPubkey.toString()}\n` +
        `Please ensure the registry account exists and is initialized.`
      );
    }

    if (!registryAccountInfo.owner.equals(SOLANA_PROGRAM_ID)) {
      throw new Error(
        `❌ Registry account owner mismatch!\n\n` +
        `The registry account at ${registryPubkey.toString()} is owned by a different program.\n\n` +
        `Current owner: ${registryAccountInfo.owner.toString()}\n` +
        `Expected owner (Program ID): ${SOLANA_PROGRAM_ID.toString()}\n\n` +
        `This means the registry account was initialized with a different program.\n\n` +
        `✅ SOLUTION:\n` +
        `1. Use a registry account that was initialized with program ${SOLANA_PROGRAM_ID.toString()}\n` +
        `2. OR re-initialize the registry using the 'initialize' instruction with the current program\n\n` +
        `Registry Address: ${registryPubkey.toString()}\n` +
        `Program ID: ${SOLANA_PROGRAM_ID.toString()}`
      );
    }
  } catch (error: any) {
    if (error.message && error.message.includes("owner mismatch")) {
      throw error;
    }
    console.warn("[withdrawSolanaUSDTFromContract] Could not validate registry account:", error);
  }

  // Get mint info for decimals
  const mintInfo = await getMint(connection, usdtMint, "confirmed", TOKEN_PROGRAM_ID);
  const parsedAmount = Number.parseFloat(amountUsdt);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid USDT amount");
  }
  const amountRaw = BigInt(Math.round(parsedAmount * 10 ** mintInfo.decimals));

  // Get registry USDT account (PDA)
  const registryUsdtAccount = DEFAULT_REGISTRY_USDT_ACCOUNT;

  // Get recipient USDT account (ATA)
  const recipientUsdtAccount = await getAssociatedTokenAddress(
    usdtMint,
    recipientPubkey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Create recipient ATA if it doesn't exist
  try {
    await getAccount(connection, recipientUsdtAccount, "confirmed", TOKEN_PROGRAM_ID);
  } catch (error: any) {
    if (error?.name === "TokenAccountNotFoundError") {
      const transaction = new Transaction();
      transaction.add(
        createAssociatedTokenAccountInstruction(
          ownerPubkey,
          recipientUsdtAccount,
          recipientPubkey,
          usdtMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      transaction.feePayer = ownerPubkey;
      transaction.recentBlockhash = latestBlockhash.blockhash;

      const signedTransaction = await phantomProvider.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3
      });

      await connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        },
        "confirmed"
      );
    } else {
      throw error;
    }
  }

  // Call withdraw_usdt instruction (camelCase for Anchor 0.32)
  const tx = await program.methods
    .withdrawUsdt(new BN(amountRaw.toString()))
    .accounts({
      registry: registryPubkey,
      owner: ownerPubkey,
      registryUsdtAccount: registryUsdtAccount,
      recipientUsdtAccount: recipientUsdtAccount,
      usdtMint: usdtMint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  return tx;
}

/**
 * Register wallet on Solana (transfers 10 USDT and registers)
 * @param walletAddress - The wallet address to register
 * @param registryAddress - The registry account address (from contract config)
 * @param usdtTokenAddress - The USDT token mint address (from contract config, optional - defaults to devnet)
 */
export async function registerSolanaWallet(
  walletAddress: string,
  registryAddress: string,
  usdtTokenAddress?: string
): Promise<string> {
  // Store these in outer scope for error handling
  let registryPubkey: PublicKey | undefined;
  let walletPubkey: PublicKey | undefined;
  
  try {
    console.log('[registerSolanaWallet] Starting with params:', { walletAddress, registryAddress });
    
    const provider = await getSolanaProvider();
    if (!provider) {
      throw new Error('Phantom wallet not connected');
    }
    console.log('[registerSolanaWallet] Provider obtained');

    const program = await getSolanaProgram();
    console.log('[registerSolanaWallet] Program obtained:', program.programId.toString());
    
    const connection = getSolanaConnection();
    
    // Validate and create PublicKeys
    
    try {
      walletPubkey = new PublicKey(walletAddress);
      console.log('[registerSolanaWallet] Wallet pubkey created:', walletPubkey.toString());
    } catch (error) {
      throw new Error(`Invalid wallet address: ${walletAddress}`);
    }
    
    let registryPubkey: PublicKey;
    try {
      const correctRegistryAddress = 'DwrJcymdTGdiuHK9boV8MPtDmUqMTwzfyvDB8hePMNG4';
      
      if (registryAddress && registryAddress !== correctRegistryAddress) {
        console.warn(`[registerSolanaWallet] WARNING: Backend returned old registry address: ${registryAddress}`);
        console.warn(`[registerSolanaWallet] Using correct registry account: ${correctRegistryAddress}`);
        registryPubkey = getDefaultRegistryAccount();
      } else {
        registryPubkey = getDefaultRegistryAccount();
      }
      
      console.log('[registerSolanaWallet] Using registry address:', registryPubkey.toString());
      console.log('[registerSolanaWallet] Program ID:', SOLANA_PROGRAM_ID.toString());
      
      if (registryPubkey.equals(SOLANA_PROGRAM_ID)) {
        throw new Error(
          `Invalid registry address: The address provided is the program ID, not the registry account. ` +
          `Please provide the actual registry account address: ${DEFAULT_REGISTRY_ACCOUNT.toString()}`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid registry address')) {
        throw error;
      }
      throw new Error(`Invalid registry address: ${registryAddress}. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Use USDT token address from config, or default to devnet
    const usdtMint = usdtTokenAddress 
      ? new PublicKey(usdtTokenAddress)
      : SOLANA_DEVNET_USDT_MINT;
    console.log('[registerSolanaWallet] USDT mint:', usdtMint.toString());
    console.log('[registerSolanaWallet] USDT mint source:', usdtTokenAddress ? 'from config' : 'default (devnet)');

    // Derive the registry USDT account PDA based on the actual USDT mint
    // This ensures it works for both devnet and mainnet
    const registryUsdtAccountPDA = getRegistryUsdtAccountPDA(usdtMint);
    const registryUsdtAccount = registryUsdtAccountPDA;
    console.log('[registerSolanaWallet] Registry USDT account (PDA):', registryUsdtAccount.toString());
    console.log('[registerSolanaWallet] Registry USDT account:', registryUsdtAccount.toString());
    
    // Check if registry USDT account exists with retry logic for RPC reliability
    let registryUsdtAccountExists = false;
    const maxRetries = 5; // Increased retries for production
    const commitmentLevels: ('confirmed' | 'finalized')[] = ['finalized', 'confirmed'];
    
    // Helper function to check if error indicates account doesn't exist
    const isAccountNotFoundError = (error: any): boolean => {
      if (!error) return false;
      const errorName = error?.name || error?.constructor?.name || '';
      const errorMessage = String(error?.message || '').toLowerCase();
      
      // Check for various forms of "account not found" errors
      return (
        errorName === 'TokenAccountNotFoundError' ||
        errorName.includes('NotFound') ||
        errorMessage.includes('account not found') ||
        errorMessage.includes('invalid account') ||
        errorMessage.includes('could not find account') ||
        (error?.code === -32602 && errorMessage.includes('account'))
      );
    };
    
    // Helper function to check if error is a retryable network error
    const isRetryableError = (error: any): boolean => {
      if (!error) return false;
      const errorMessage = String(error?.message || '').toLowerCase();
      const errorCode = error?.code;
      
      return (
        errorMessage.includes('timeout') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('network') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('failed to fetch') ||
        errorCode === -32002 || // RPC server error
        errorCode === -32005 || // Request limit exceeded
        errorCode === -32603  // Internal error
      );
    };
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      for (const commitment of commitmentLevels) {
        try {
          console.log(`[registerSolanaWallet] Checking registry USDT account (attempt ${attempt + 1}/${maxRetries}, commitment: ${commitment})...`);
          await getAccount(connection, registryUsdtAccount, commitment, TOKEN_PROGRAM_ID);
          registryUsdtAccountExists = true;
          console.log(`[registerSolanaWallet] Registry USDT account exists ✓ (found with ${commitment} commitment)`);
          break;
        } catch (error: any) {
          if (isAccountNotFoundError(error)) {
            // Account definitely doesn't exist - but only break if we've tried all commitment levels
            if (commitment === 'confirmed') {
              registryUsdtAccountExists = false;
              console.log(`[registerSolanaWallet] Registry USDT account does not exist (${commitment} commitment)`);
              // Don't break here - try finalized first
            }
          } else if (isRetryableError(error)) {
            // RPC error - retry
            console.warn(`[registerSolanaWallet] RPC error checking account (${commitment} commitment, attempt ${attempt + 1}):`, {
              message: error?.message,
              code: error?.code,
              name: error?.name
            });
            if (attempt < maxRetries - 1) {
              // Wait before retry (exponential backoff)
              const delay = 1000 * (attempt + 1);
              console.log(`[registerSolanaWallet] Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          } else {
            // Other error - log but don't treat as "doesn't exist" - might be a false negative
            console.warn(`[registerSolanaWallet] Unexpected error checking account (${commitment} commitment):`, {
              message: error?.message,
              code: error?.code,
              name: error?.name,
              error: error
            });
            // Don't break - continue to next commitment level or retry
          }
        }
      }
      if (registryUsdtAccountExists) break;
    }
    
    // Final check: if still not found, try getAccountInfo as fallback (more reliable)
    if (!registryUsdtAccountExists) {
      console.log('[registerSolanaWallet] Primary check failed, trying alternative methods...');
      
      // Try getAccountInfo with multiple commitment levels
      for (const commitment of ['finalized', 'confirmed'] as const) {
        try {
          console.log(`[registerSolanaWallet] Trying getAccountInfo with ${commitment} commitment...`);
          const accountInfo = await connection.getAccountInfo(registryUsdtAccount, commitment);
          if (accountInfo) {
            // Check if it's a token account by verifying owner
            if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
              registryUsdtAccountExists = true;
              console.log(`[registerSolanaWallet] Registry USDT account exists ✓ (found via getAccountInfo with ${commitment} commitment)`);
              break;
            } else {
              console.warn(`[registerSolanaWallet] Account exists but owner is ${accountInfo.owner.toString()}, expected ${TOKEN_PROGRAM_ID.toString()}`);
            }
          } else {
            console.log(`[registerSolanaWallet] Account info is null with ${commitment} commitment`);
          }
        } catch (error: any) {
          console.warn(`[registerSolanaWallet] getAccountInfo failed with ${commitment} commitment:`, error?.message || error);
        }
      }
      
      // Last resort: try to get multiple accounts at once (batch request)
      if (!registryUsdtAccountExists) {
        try {
          console.log('[registerSolanaWallet] Trying batch account info check...');
          const accounts = await connection.getMultipleAccountsInfo([registryUsdtAccount], 'finalized');
          if (accounts && accounts[0] && accounts[0].owner.equals(TOKEN_PROGRAM_ID)) {
            registryUsdtAccountExists = true;
            console.log('[registerSolanaWallet] Registry USDT account exists ✓ (found via getMultipleAccountsInfo)');
          }
        } catch (error: any) {
          console.warn('[registerSolanaWallet] Batch check also failed:', error?.message || error);
        }
      }
    }
    
    if (!registryUsdtAccountExists) {
      // registryUsdtAccountPDA is already derived above
      
      // Additional diagnostic: try to get account info directly
      let diagnosticInfo = '';
      try {
        const accountInfo = await connection.getAccountInfo(registryUsdtAccount, 'finalized');
        if (accountInfo) {
          diagnosticInfo = `\n⚠️ NOTE: Account exists but may not be a valid token account. Owner: ${accountInfo.owner.toString()}`;
        }
      } catch (diagError) {
        diagnosticInfo = `\n⚠️ Diagnostic check also failed. This might be an RPC connectivity issue.`;
      }
      
      throw new Error(
        `❌ Registry USDT account not initialized! ` +
        `\n\nThe registry USDT token account has not been initialized. ` +
        `\n\nThis account must be created before wallets can be registered. ` +
        `\n\n✅ SOLUTION:` +
        `\n1. Call the 'initialize_registry_usdt_account' instruction to create the registry USDT token account` +
        `\n2. This is a separate step from initializing the registry account` +
        `\n3. The registry account must exist first, then call initialize_registry_usdt_account` +
        `\n4. After initialization, try registering your wallet again` +
        `\n\nRegistry Address: ${registryPubkey.toString()}` +
        `\nRegistry USDT Account (PDA): ${registryUsdtAccount.toString()}` +
        `\nUSDT Mint: ${usdtMint.toString()}` +
        `\nProgram ID: ${SOLANA_PROGRAM_ID.toString()}` +
        diagnosticInfo
      );
    }

    const userUsdtAccount = await getAssociatedTokenAddress(
      usdtMint,
      walletPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log('[registerSolanaWallet] User USDT account (ATA):', userUsdtAccount.toString());

    let accountExists = false;
    try {
      await getAccount(connection, userUsdtAccount, 'confirmed', TOKEN_PROGRAM_ID);
      accountExists = true;
      console.log('[registerSolanaWallet] USDT token account (ATA) exists ✓');
    } catch (error: any) {
      if (error?.name === 'TokenAccountNotFoundError') {
        accountExists = false;
        console.log('[registerSolanaWallet] USDT token account (ATA) does not exist yet');
      } else {
        throw error;
      }
    }

    // Get the mint's actual decimals
    console.log('[registerSolanaWallet] Fetching USDT mint decimals...');
    let mintDecimals: number;
    try {
      const mintInfo = await getMint(connection, usdtMint, 'confirmed', TOKEN_PROGRAM_ID);
      mintDecimals = mintInfo.decimals;
      console.log('[registerSolanaWallet] USDT mint decimals:', mintDecimals);
    } catch (error) {
      console.error('[registerSolanaWallet] Failed to get mint decimals:', error);
      throw new Error(`Failed to get USDT mint decimals: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Calculate required amount based on actual decimals (10 USDT)
    const requiredAmount = BigInt(10) * BigInt(10 ** mintDecimals);
    console.log('[registerSolanaWallet] Required amount (10 USDT):', requiredAmount.toString(), `(${10} * 10^${mintDecimals})`);
    
    // Check user balance (this will be 0 if ATA doesn't exist)
    console.log('[registerSolanaWallet] Checking USDT balance...');
    const balance = await getSolanaUSDTBalance(walletAddress);
    const balanceInUsdt = Number(balance) / Number(10 ** mintDecimals);
    console.log('[registerSolanaWallet] USDT balance:', balanceInUsdt, 'USDT');
    
    if (!accountExists) {
      console.log('[registerSolanaWallet] Attempting to create Associated Token Account...');
        console.log('[registerSolanaWallet] ATA creation parameters:', {
          payer: walletPubkey.toString(),
          associatedToken: userUsdtAccount.toString(),
          owner: walletPubkey.toString(),
          mint: usdtMint.toString(),
          tokenProgram: TOKEN_PROGRAM_ID.toString(),
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID.toString(),
        });
        
        try {
          const phantomProvider = getPhantomProvider();
          if (!phantomProvider || !phantomProvider.publicKey) {
            throw new Error('Phantom wallet not connected');
          }
          
          if (!phantomProvider.publicKey.equals(walletPubkey)) {
            throw new Error(`Wallet mismatch. Connected: ${phantomProvider.publicKey.toString()}, Expected: ${walletPubkey.toString()}`);
          }
          
          const createATAInstruction = createAssociatedTokenAccountInstruction(
            walletPubkey,
            userUsdtAccount,
            walletPubkey,
            usdtMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
        
        console.log('[registerSolanaWallet] ATA instruction created successfully');
        
        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
        const transaction = new Transaction({
          feePayer: walletPubkey,
          recentBlockhash: latestBlockhash.blockhash,
        }).add(createATAInstruction);
        
        console.log('[registerSolanaWallet] Transaction built, requesting signature...');
        const signedTransaction = await phantomProvider.signTransaction(transaction);
        console.log('[registerSolanaWallet] Transaction signed, sending...');
        
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
        console.log('[registerSolanaWallet] Transaction sent, signature:', signature);
        
        await connection.confirmTransaction({
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        }, 'confirmed');
        
        console.log('[registerSolanaWallet] Associated Token Account created ✓');
        console.log('[registerSolanaWallet] Transaction confirmed:', signature);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newBalance = await getSolanaUSDTBalance(walletAddress);
        const newBalanceInUsdt = Number(newBalance) / Number(10 ** mintDecimals);
        console.log('[registerSolanaWallet] USDT balance after ATA creation:', newBalanceInUsdt, 'USDT');
        
        if (newBalance < requiredAmount) {
          throw new Error(
            `Insufficient USDT balance. Required: 10 USDT, Available: ${newBalanceInUsdt} USDT. ` +
            `Please ensure you have at least 10 USDT in your wallet's Associated Token Account.`
          );
        }
      } catch (createError: any) {
        console.error('[registerSolanaWallet] Failed to create ATA:', createError);
        console.error('[registerSolanaWallet] Create error details:', {
          message: createError?.message,
          name: createError?.name,
          code: createError?.code,
          stack: createError?.stack,
          logs: createError?.logs,
        });
        
        if (createError?.logs) {
          console.error('[registerSolanaWallet] Transaction logs:', createError.logs);
        }
        
        const errorMsg = createError?.message || String(createError);
        const logs = createError?.logs ? `\n\nTransaction logs:\n${createError.logs.join('\n')}` : '';
        
        if (balance === BigInt(0)) {
          throw new Error(
            `USDT Associated Token Account not found and could not be created. ` +
            `Please ensure:` +
            `\n1. You have USDT in your wallet` +
            `\n2. You have enough SOL for transaction fees` +
            `\n3. Your wallet is connected and unlocked` +
            `\n4. The token mint address is correct: Ch9MipiMpaZBkCZFPTsArZigDwEH85Yodp2RcPjSmsvr` +
            `\n\nIf you have USDT but in a different token account, you may need to transfer it to your Associated Token Account first.` +
            `\n\nError: ${errorMsg}${logs}`
          );
        }
        
        throw new Error(`Failed to create Associated Token Account: ${errorMsg}${logs}`);
      }
    } else if (balance < requiredAmount) {
      throw new Error(`Insufficient USDT balance. Required: 10 USDT, Available: ${balanceInUsdt} USDT`);
    }

    // Call register_wallet instruction
    // The instruction should handle the USDT transfer internally
    try {
      console.log('[registerSolanaWallet] Preparing registerWallet instruction with accounts:', {
        registry: registryPubkey.toString(),
        wallet: walletPubkey.toString(),
        userUsdtAccount: userUsdtAccount.toString(),
        registryUsdtAccount: registryUsdtAccount.toString(),
        usdtMint: usdtMint.toString(),
        tokenProgram: TOKEN_PROGRAM_ID.toString(),
      });
      
      // Validate all accounts are valid PublicKeys
      if (!registryPubkey || !walletPubkey || !userUsdtAccount || !registryUsdtAccount) {
        throw new Error('One or more accounts are undefined');
      }
      
      console.log('[registerSolanaWallet] All accounts validated, calling program.methods.registerWallet()...');
      
      // Check if registry account exists and is valid
      console.log('[registerSolanaWallet] Checking if registry account exists at:', registryPubkey.toString());
      try {
        const registryAccountInfo = await connection.getAccountInfo(registryPubkey, 'confirmed');
        if (!registryAccountInfo) {
          throw new Error(
            `❌ Registry account does not exist at address ${registryPubkey.toString()}. ` +
            `\n\nThe registry must be initialized first using the 'initialize' instruction. ` +
            `\n\n✅ SOLUTION:` +
            `\n1. Call the 'initialize' instruction on your Solana program` +
            `\n2. This will create the registry account at: ${registryPubkey.toString()}` +
            `\n3. After initialization, try registering your wallet again` +
            `\n\nProgram ID: ${SOLANA_PROGRAM_ID.toString()}` +
            `\nRegistry Address: ${registryPubkey.toString()}`
          );
        }
        
        console.log('[registerSolanaWallet] Registry account exists:', {
          address: registryPubkey.toString(),
          owner: registryAccountInfo.owner.toString(),
          lamports: registryAccountInfo.lamports,
          dataLength: registryAccountInfo.data.length,
        });
        
        if (!registryAccountInfo.owner.equals(SOLANA_PROGRAM_ID)) {
          throw new Error(
            `❌ Registry account owner mismatch! ` +
            `\n\nThe registry account at ${registryPubkey.toString()} is owned by a different program.` +
            `\n\nCurrent owner: ${registryAccountInfo.owner.toString()}` +
            `\nExpected owner (Program ID): ${SOLANA_PROGRAM_ID.toString()}` +
            `\n\nThis means the registry account was initialized by a different program or is not the correct registry account.` +
            `\n\n✅ SOLUTION:` +
            `\n1. Verify you're using the correct registry account address` +
            `\n2. If the registry was initialized with a different program, you need to:` +
            `\n   - Use the registry account that was initialized with program ${SOLANA_PROGRAM_ID.toString()}` +
            `\n   - OR re-initialize the registry using the 'initialize' instruction with program ${SOLANA_PROGRAM_ID.toString()}` +
            `\n\nRegistry Address: ${registryPubkey.toString()}` +
            `\nProgram ID: ${SOLANA_PROGRAM_ID.toString()}`
          );
        }
        
        // Check if account has data (should have registry data)
        if (registryAccountInfo.data.length === 0) {
          throw new Error(
            `❌ Registry account has no data! ` +
            `\n\nRegistry account: ${registryPubkey.toString()}` +
            `\nThe registry account exists but is empty. Please re-initialize the registry.`
          );
        }
        
        console.log('[registerSolanaWallet] Registry account validation passed ✓');
      } catch (checkError: any) {
        if (checkError.message.includes('does not exist') || 
            checkError.message.includes('owner mismatch') ||
            checkError.message.includes('has no data')) {
          throw checkError;
        }
        console.warn('[registerSolanaWallet] Could not check registry account:', checkError);
        // Continue anyway, but log the warning
      }
      
      console.log('[registerSolanaWallet] Executing transaction...');
      let tx: string;
      try {
        tx = await program.methods
          .registerWallet()
          .accounts({
            registry: registryPubkey,
            wallet: walletPubkey,
            userUsdtAccount: userUsdtAccount,
            registryUsdtAccount: registryUsdtAccount,
            usdtMint: usdtMint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      } catch (rpcError: any) {
        console.error('[registerSolanaWallet] RPC error:', rpcError);
        console.error('[registerSolanaWallet] RPC error details:', {
          message: rpcError?.message,
          error: rpcError?.error,
          logs: rpcError?.logs,
          code: rpcError?.code,
          stack: rpcError?.stack,
        });
        throw rpcError;
      }

      console.log('[registerSolanaWallet] Transaction successful:', tx);
      return tx;
    } catch (programError: any) {
      console.error('[registerSolanaWallet] Solana program error:', programError);
      if (programError.logs) {
        console.error('[registerSolanaWallet] Program logs:', programError.logs);
      }
      throw programError;
    }
  } catch (error: any) {
    console.error('[registerSolanaWallet] Error:', error);
    
    if (error?.code === 4001 || error?.message?.includes('User rejected')) {
      throw new Error('User rejected the transaction');
    }
    if (error?.code === 6000 || error?.error?.code === 6000) {
      throw new Error('Wallet already registered');
    }
    
    const errorMsg = error?.message || error?.error?.message || error?.toString() || 'Unknown error';
    const errorCode = error?.code || error?.error?.code || '';
    const errorLogs = error?.logs ? `\nLogs: ${error.logs.join('\n')}` : '';
    throw new Error(`Solana wallet registration failed: ${errorMsg}${errorCode ? ` (code: ${errorCode})` : ''}${errorLogs}`);
  }
}
