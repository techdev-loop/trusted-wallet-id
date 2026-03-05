# Smart Contract Integration Guide

This guide explains how to integrate the deployed Ethereum smart contract with the backend and frontend.

## Deployed Contract Information

- **Contract Address**: `0xF694F2d247E46cc1e4b3d0Fb2b55b8bb5C5573bA`
- **Network**: Sepolia Testnet
- **USDT Token**: `0xfd311848ae9dd8ffac8bcd862bc14d38aa77f946` (Sepolia testnet token)
- **Verified**: ✅ Yes - https://sepolia.etherscan.io/address/0xF694F2d247E46cc1e4b3d0Fb2b55b8bb5C5573bA#code

## Step 1: Update Backend Configuration

### 1.1 Update `backend/.env`

Add or update these environment variables:

```env
# Ethereum Sepolia Testnet
ETHEREUM_CONTRACT_ADDRESS=0xF694F2d247E46cc1e4b3d0Fb2b55b8bb5C5573bA
ETHEREUM_NETWORK=sepolia
ETHEREUM_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
SEPOLIA_USDT_ADDRESS=0xfd311848ae9dd8ffac8bcd862bc14d38aa77f946
```

### 1.2 Initialize Contract Configuration in Database

Run the initialization script:

```bash
cd backend
npm run contracts:init
```

This will:
- Save the contract address to the `contract_configs` table
- Configure the USDT token address for Sepolia
- Set up the RPC URL

### 1.3 Verify Database Configuration

You can verify the configuration was saved:

```sql
SELECT * FROM contract_configs WHERE chain = 'ethereum';
```

Expected output:
- chain: `ethereum`
- contract_address: `0xF694F2d247E46cc1e4b3d0Fb2b55b8bb5C5573bA`
- usdt_token_address: `0xfd311848ae9dd8ffac8bcd862bc14d38aa77f946`
- network_name: `sepolia`
- rpc_url: `https://ethereum-sepolia-rpc.publicnode.com`

## Step 2: Frontend Configuration

### 2.1 Update Chain Configuration

The frontend already has the chain configuration in `src/lib/web3.ts`. For Sepolia testnet, make sure:

1. **MetaMask is connected to Sepolia**:
   - Network: Sepolia
   - Chain ID: 11155111
   - RPC URL: https://ethereum-sepolia-rpc.publicnode.com

2. **Frontend will fetch contract address from backend**:
   - The `/web3/contract-config/ethereum` endpoint will return the deployed contract address
   - No frontend code changes needed!

## Step 3: Test the Integration

### 3.1 Start Backend

```bash
cd backend
npm run dev
```

The backend should start on `http://localhost:4000`

### 3.2 Start Frontend

```bash
npm run dev
```

The frontend should start on `http://localhost:8080`

### 3.3 Test Flow

1. **Visit**: http://localhost:8080/web3-wallet
2. **Select Chain**: Ethereum
3. **Connect Wallet**: 
   - Make sure MetaMask is on Sepolia testnet
   - Click "Connect Wallet"
4. **Approve USDT**:
   - You'll need Sepolia testnet USDT tokens
   - Click "Approve USDT"
5. **Pay & Register**:
   - Click "Pay & Verify Wallet"
   - Transaction will be sent to the deployed contract
   - Wait for confirmation
6. **Verification**:
   - Backend will verify the transaction
   - Wallet will be registered in database

## Step 4: Get Testnet Tokens

### Sepolia ETH (for gas)
- Visit: https://sepoliafaucet.com/
- Or: https://faucet.quicknode.com/ethereum/sepolia

### Sepolia USDT (for payment)
You'll need testnet USDT tokens. Options:
1. Deploy a mock USDT token on Sepolia
2. Use an existing testnet token
3. Use the address: `0xfd311848ae9dd8ffac8bcd862bc14d38aa77f946` (if it has tokens)

## API Endpoints

### Get Contract Configuration
```bash
GET /api/web3/contract-config/ethereum
```

Response:
```json
{
  "chain": "ethereum",
  "contractAddress": "0xF694F2d247E46cc1e4b3d0Fb2b55b8bb5C5573bA",
  "usdtTokenAddress": "0xfd311848ae9dd8ffac8bcd862bc14d38aa77f946",
  "networkName": "sepolia"
}
```

### Verify Payment
```bash
POST /api/web3/verify-payment
Content-Type: application/json

{
  "chain": "ethereum",
  "txHash": "0x...",
  "walletAddress": "0x..."
}
```

## Troubleshooting

### "Contract address not found"
- Run `npm run contracts:init` in backend
- Check `.env` file has `ETHEREUM_CONTRACT_ADDRESS` set

### "Failed to get contract configuration"
- Check backend is running
- Check database has contract config
- Verify API endpoint: `GET /api/web3/contract-config/ethereum`

### "Transaction failed"
- Check you have Sepolia ETH for gas
- Check you have Sepolia USDT tokens
- Verify MetaMask is on Sepolia network
- Check contract address is correct

### "USDT approval failed"
- Make sure you have USDT tokens
- Check the USDT token address is correct
- Verify you're on the correct network

## Next Steps

1. ✅ Contract deployed and verified
2. ✅ Backend configuration updated
3. ✅ Database initialized
4. ⏭️ Test the full flow
5. ⏭️ Deploy to other chains (BSC, Tron, Solana)
6. ⏭️ Deploy to mainnets (after thorough testing)

## Contract Interaction Flow

```
User → Frontend → MetaMask → Smart Contract (Sepolia)
                              ↓
                         Transaction
                              ↓
User → Frontend → Backend → Verify Transaction → Database
```

## Security Notes

- ⚠️ This is testnet - use testnet tokens only
- ⚠️ Contract is verified on Etherscan
- ⚠️ Always verify contract address before transactions
- ⚠️ Test thoroughly before mainnet deployment
