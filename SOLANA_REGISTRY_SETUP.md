# Solana Registry Account Setup (Devnet)

## Problem
The error "Cannot read properties of undefined (reading '_bn')" occurs because the registry account doesn't exist or the address is incorrect on Solana devnet.

## Current Configuration (Devnet)

- **Program ID**: `BPyPGZZ4Ckxeypa1bTEHd1XS6kEiu1hDrWzFcBD5M6aG`
- **Network**: Devnet
- **RPC URL**: `https://api.devnet.solana.com`
- **USDT Mint**: `G8vDrj3UxWVWFcvKE6tAYSwq7G6PSv164c58oVtfCoXC`

## Solution

### Step 1: Initialize the Registry Account (If Not Done)

The registry account must be created by calling the `initialize` instruction. You can do this:

**Option A: Use the Helper Function (Recommended)**
```typescript
import { initializeSolanaRegistry } from '@/lib/solana';

// Connect your Phantom wallet first, then:
const registryAddress = await initializeSolanaRegistry(yourWalletAddress);
console.log('Registry account created at:', registryAddress);
```

**Option B: Call Initialize Manually**
1. Use Solana CLI or a script to call the `initialize` instruction
2. The instruction requires:
   - `registry`: A new account keypair (will be created)
   - `owner`: Your wallet address (signer)
   - `usdt_mint`: `G8vDrj3UxWVWFcvKE6tAYSwq7G6PSv164c58oVtfCoXC`
3. After the transaction succeeds, note the registry account address

### Step 2: Find Your Registry Account Address

If you've already initialized:

**From Solana Explorer (Devnet)**
1. Go to https://explorer.solana.com/?cluster=devnet
2. Search for your program ID: `BPyPGZZ4Ckxeypa1bTEHd1XS6kEiu1hDrWzFcBD5M6aG`
3. Look for the `initialize` transaction
4. Find the account that was created (the `registry` account)
5. Copy that account address

**From Your Initialize Transaction**
1. Go to https://explorer.solana.com/?cluster=devnet
2. Paste your initialize transaction signature
3. Look at the accounts involved
4. The `registry` account is the one that was created (not the program ID)

### Step 3: Update Contract Configuration

Once you have the registry account address:

```bash
cd backend
# Set the actual registry account address (NOT the program ID)
SOLANA_CONTRACT_ADDRESS=<REGISTRY_ACCOUNT_ADDRESS> npm run contracts:init
```

Or update `backend/.env`:
```env
SOLANA_CONTRACT_ADDRESS=<REGISTRY_ACCOUNT_ADDRESS>
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_DEVNET_USDT_ADDRESS=G8vDrj3UxWVWFcvKE6tAYSwq7G6PSv164c58oVtfCoXC
```

Then run:
```bash
cd backend
npm run contracts:init
```

### Step 4: Verify

The script should output:
```
✓ Configured solana contract
```

Verify in database:
```sql
SELECT * FROM contract_configs WHERE chain = 'solana';
```

Should show:
- `contract_address`: Your registry account address (NOT the program ID)
- `network_name`: `devnet`
- `rpc_url`: `https://api.devnet.solana.com`

## Important Notes

- **DO NOT** use the program ID (`BPyPGZZ4Ckxeypa1bTEHd1XS6kEiu1hDrWzFcBD5M6aG`) as the registry address
- The registry account is a **separate account** created by the `initialize` instruction
- The registry account must exist on devnet before you can call `registerWallet`
- Make sure you're using devnet USDT (`G8vDrj3UxWVWFcvKE6tAYSwq7G6PSv164c58oVtfCoXC`)

## Troubleshooting

**Error: "Registry address is the same as program ID"**
- You're using the program ID instead of the registry account address
- Find the actual registry account address from your initialize transaction
- Update `SOLANA_CONTRACT_ADDRESS` in backend/.env

**Error: "Registry account does not exist"**
- The registry hasn't been initialized yet on devnet
- Call the `initialize` instruction first using `initializeSolanaRegistry()` or manually

**Error: "Cannot read properties of undefined (reading '_bn')"**
- This means Anchor is trying to deserialize a non-existent account
- Make sure the registry account exists on devnet and the address is correct
- Verify the account exists: https://explorer.solana.com/address/<REGISTRY_ADDRESS>?cluster=devnet
