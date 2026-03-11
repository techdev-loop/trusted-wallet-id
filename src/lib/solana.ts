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

// Solana devnet RPC URL
const SOLANA_DEVNET_RPC = 'https://api.devnet.solana.com';

// USDT mint address on Solana devnet
export const SOLANA_DEVNET_USDT_MINT = new PublicKey('Ch9MipiMpaZBkCZFPTsArZigDwEH85Yodp2RcPjSmsvr');

/**
 * Get Solana connection (devnet)
 */
export function getSolanaConnection(): Connection {
  return new Connection(SOLANA_DEVNET_RPC, 'confirmed');
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
 * Register wallet on Solana (transfers 10 USDT and registers)
 * @param walletAddress - The wallet address to register
 * @param registryAddress - The registry account address (from contract config)
 */
export async function registerSolanaWallet(
  walletAddress: string,
  registryAddress: string
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
    
    const usdtMint = SOLANA_DEVNET_USDT_MINT;
    console.log('[registerSolanaWallet] USDT mint:', usdtMint.toString());
    console.log('[registerSolanaWallet] Verifying USDT mint address matches:', 'Ch9MipiMpaZBkCZFPTsArZigDwEH85Yodp2RcPjSmsvr');
    
    if (!usdtMint.equals(new PublicKey('Ch9MipiMpaZBkCZFPTsArZigDwEH85Yodp2RcPjSmsvr'))) {
      throw new Error(`USDT mint address mismatch. Expected: Ch9MipiMpaZBkCZFPTsArZigDwEH85Yodp2RcPjSmsvr, Got: ${usdtMint.toString()}`);
    }

    // Use the provided registry USDT account address directly
    const registryUsdtAccount = getDefaultRegistryUsdtAccount();
    console.log('[registerSolanaWallet] Registry USDT account:', registryUsdtAccount.toString());
    
    // Check if registry USDT account exists
    let registryUsdtAccountExists = false;
    try {
      await getAccount(connection, registryUsdtAccount, 'confirmed', TOKEN_PROGRAM_ID);
      registryUsdtAccountExists = true;
      console.log('[registerSolanaWallet] Registry USDT account exists ✓');
    } catch (error: any) {
      if (error?.name === 'TokenAccountNotFoundError') {
        registryUsdtAccountExists = false;
        console.log('[registerSolanaWallet] Registry USDT account does not exist yet');
      } else {
        console.warn('[registerSolanaWallet] Error checking registry USDT account:', error);
      }
    }
    
    if (!registryUsdtAccountExists) {
      throw new Error(
        `❌ Registry USDT account not initialized! ` +
        `\n\nThe registry USDT token account at ${registryUsdtAccount.toString()} has not been initialized. ` +
        `\n\nThis account must be created before wallets can be registered. ` +
        `\n\n✅ SOLUTION:` +
        `\n1. The registry must be initialized using the 'initialize' instruction` +
        `\n2. This will create both the registry account and the registry USDT token account` +
        `\n3. After initialization, try registering your wallet again` +
        `\n\nRegistry Address: ${registryPubkey.toString()}` +
        `\nRegistry USDT Account: ${registryUsdtAccount.toString()}` +
        `\nProgram ID: ${SOLANA_PROGRAM_ID.toString()}`
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
