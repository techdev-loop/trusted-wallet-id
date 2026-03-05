# Web3 Multi-Chain Wallet Verification Implementation

This document describes the implementation of the Web3 wallet connection and smart contract payment workflow.

## Overview

The new workflow allows users to:
1. Connect their Web3 wallet (Ethereum, BSC, Tron, or Solana)
2. Approve USDT token spending
3. Pay 10 USDT via smart contract
4. Automatically become identity-verified upon successful payment

## Architecture

### Smart Contracts

Smart contracts are deployed on each supported blockchain:

- **Ethereum**: `contracts/ethereum/WalletRegistry.sol`
- **BSC**: Same contract as Ethereum (deployed separately)
- **Tron**: `contracts/tron/WalletRegistry.sol`
- **Solana**: `contracts/solana/programs/wallet-registry/src/lib.rs`

All contracts implement:
- USDT token acceptance (10 USDT fee)
- Wallet registration
- Event emission for backend tracking
- Owner controls for fund withdrawal

### Backend Changes

#### New Database Tables

1. **wallet_users**: Stores wallet-first registrations (no email required)
2. **contract_configs**: Stores smart contract addresses and RPC URLs per chain
3. **Updated wallet_links**: Added `chain`, `contract_address`, `registration_method` fields
4. **Updated fee_payments**: Added `chain`, `contract_address`, `block_number`, `block_hash` fields

#### New Services

- **blockchain.service.ts**: Handles on-chain transaction verification
  - `verifyEVMTransaction()`: Verifies Ethereum/BSC transactions
  - `verifySolanaTransaction()`: Verifies Solana transactions (placeholder)
  - `verifyTronTransaction()`: Verifies Tron transactions (placeholder)
  - `registerWalletPayment()`: Records verified payments in database
  - `isWalletVerified()`: Checks wallet verification status

#### New API Endpoints

- `POST /api/web3/connect`: Connect wallet and get/create user session
- `POST /api/web3/verify-payment`: Verify payment transaction and register wallet
- `GET /api/web3/status/:walletAddress/:chain`: Check wallet verification status
- `GET /api/web3/contract-config/:chain`: Get contract configuration for a chain

### Frontend Changes

#### New Components

- **Web3Wallet.tsx**: Main page for Web3 wallet connection and payment flow
  - Chain selection (Ethereum, BSC, Tron, Solana)
  - Wallet connection
  - Token approval
  - Payment processing
  - Status verification

#### New Utilities

- **web3.ts**: Web3 interaction utilities
  - `connectWallet()`: Connect to MetaMask/wallet
  - `approveUSDT()`: Approve USDT spending
  - `checkUSDTAllowance()`: Check current allowance
  - `registerWalletViaContract()`: Call smart contract registration
  - Chain configuration and USDT addresses

## Setup Instructions

### 1. Database Migration

Run the database migration to add new tables and columns:

```bash
cd backend
npm run db:init
```

Or manually run: `backend/sql/wallet_schema_update.sql`

### 2. Deploy Smart Contracts

Deploy contracts to each chain:

**Ethereum/BSC:**
```bash
# Install dependencies
npm install @openzeppelin/contracts

# Compile and deploy
npx hardhat compile
npx hardhat run scripts/deploy.js --network ethereum
npx hardhat run scripts/deploy.js --network bsc
```

**Tron:**
```bash
# Deploy using TronBox or TronWeb
tronbox migrate --network mainnet
```

**Solana:**
```bash
cd contracts/solana
anchor build
anchor deploy --provider.cluster mainnet-beta
```

### 3. Configure Contract Addresses

Set environment variables in `backend/.env`:

```env
# Ethereum
ETHEREUM_CONTRACT_ADDRESS=0x...
ETHEREUM_RPC_URL=https://eth.llamarpc.com
ETHEREUM_NETWORK=mainnet

# BSC
BSC_CONTRACT_ADDRESS=0x...
BSC_RPC_URL=https://bsc-dataseed.binance.org
BSC_NETWORK=mainnet

# Tron
TRON_CONTRACT_ADDRESS=0x...
TRON_RPC_URL=https://api.trongrid.io
TRON_NETWORK=mainnet

# Solana
SOLANA_CONTRACT_ADDRESS=...
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
```

Then initialize contract configurations:

```bash
cd backend
npm run contracts:init
```

### 4. Install Frontend Dependencies

```bash
npm install ethers
```

## User Flow

1. **User visits `/web3-wallet`**
   - Selects blockchain (Ethereum, BSC, Tron, or Solana)
   - Clicks "Connect Wallet"

2. **Wallet Connection**
   - MetaMask/wallet prompts for connection
   - User approves
   - Frontend checks if wallet is already verified

3. **If Not Verified:**
   - Frontend fetches contract address from backend
   - User sees "Approve USDT" button
   - User approves unlimited USDT spending (or specific amount)

4. **Payment**
   - User clicks "Pay & Verify Wallet"
   - Frontend calls smart contract `registerWallet()` function
   - Transaction is submitted to blockchain
   - Frontend waits for transaction confirmation

5. **Verification**
   - Frontend sends transaction hash to backend
   - Backend verifies transaction on-chain
   - Backend checks:
     - Transaction exists and succeeded
     - USDT transfer to contract occurred
     - Amount is exactly 10 USDT
     - Wallet address matches
   - Backend records payment in database
   - Backend marks wallet as verified
   - Backend returns JWT token

6. **Completion**
   - User is logged in with wallet-based session
   - User can access dashboard

## Smart Contract Events

The backend can listen for `WalletRegistered` events:

```solidity
event WalletRegistered(
    address indexed wallet,
    uint256 amount,
    uint256 timestamp,
    string chain
);
```

This allows for real-time registration tracking without requiring users to submit transaction hashes.

## Security Considerations

1. **On-Chain Verification**: All payments are verified on-chain before database updates
2. **Amount Validation**: Contract enforces exact 10 USDT payment
3. **Reentrancy Protection**: Contracts use OpenZeppelin's ReentrancyGuard
4. **Access Control**: Only contract owner can withdraw funds
5. **Transaction Verification**: Backend verifies transaction details before registration

## Testing

### Local Testing

1. Deploy contracts to testnet (Sepolia, BSC Testnet, etc.)
2. Update contract addresses in backend config
3. Use testnet USDT tokens
4. Test full flow: connect → approve → pay → verify

### Production Checklist

- [ ] Contracts deployed to mainnet
- [ ] Contract addresses configured in backend
- [ ] RPC URLs configured and tested
- [ ] Database migrations applied
- [ ] Frontend builds successfully
- [ ] End-to-end flow tested on each chain
- [ ] Event listeners configured (if using)
- [ ] Monitoring set up for failed transactions

## Troubleshooting

### "Contract address not set"
- Run `npm run contracts:init` in backend
- Check environment variables are set correctly

### "Transaction verification failed"
- Check RPC URL is correct and accessible
- Verify transaction exists on blockchain
- Check transaction status (should be success)
- Verify USDT transfer amount matches exactly

### "Insufficient USDT balance"
- User needs at least 10 USDT in wallet
- Check correct USDT token address for chain
- Verify wallet is connected correctly

### "Wallet already registered"
- Wallet has already paid and been verified
- User can connect and get session token directly

## Future Enhancements

1. **Event Listeners**: Implement backend listeners for real-time registration
2. **Solana Support**: Complete Solana transaction verification
3. **Tron Support**: Complete Tron transaction verification
4. **WalletConnect**: Add WalletConnect support for mobile wallets
5. **Multi-wallet**: Support connecting multiple wallets per user
6. **Refund Mechanism**: Add ability to refund registrations (admin only)
