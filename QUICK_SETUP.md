# Quick Setup - Ethereum Contract Integration

## ✅ Contract Deployed
- **Address**: `0xF694F2d247E46cc1e4b3d0Fb2b55b8bb5C5573bA`
- **Network**: Sepolia Testnet
- **Status**: Verified ✅

## Step 1: Update Backend .env

Edit `backend/.env` and add:

```env
# Ethereum Sepolia Testnet
ETHEREUM_CONTRACT_ADDRESS=0xF694F2d247E46cc1e4b3d0Fb2b55b8bb5C5573bA
ETHEREUM_NETWORK=sepolia
ETHEREUM_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
SEPOLIA_USDT_ADDRESS=0xfd311848ae9dd8ffac8bcd862bc14d38aa77f946
```

## Step 2: Initialize Database

```bash
cd backend
npm run contracts:init
```

Expected output:
```
✓ Configured ethereum contract
Contract configurations initialized successfully!
```

## Step 3: Start Services

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## Step 4: Test Integration

1. Open: http://localhost:8080/web3-wallet
2. Select: **Ethereum**
3. Connect wallet (MetaMask on Sepolia)
4. Approve USDT
5. Pay 10 USDT
6. Verify registration

## Verify It Works

### Check Backend API
```bash
curl http://localhost:4000/api/web3/contract-config/ethereum
```

Should return:
```json
{
  "chain": "ethereum",
  "contractAddress": "0xF694F2d247E46cc1e4b3d0Fb2b55b8bb5C5573bA",
  "usdtTokenAddress": "0xfd311848ae9dd8ffac8bcd862bc14d38aa77f946",
  "networkName": "sepolia"
}
```

### Check Database
```sql
SELECT * FROM contract_configs WHERE chain = 'ethereum';
```

## Troubleshooting

**"Contract address not found"**
- Run `npm run contracts:init` in backend
- Check `.env` has `ETHEREUM_CONTRACT_ADDRESS`

**"Failed to get contract configuration"**
- Backend running? Check http://localhost:4000/api/health
- Database initialized? Run `npm run contracts:init`

**"Transaction failed"**
- MetaMask on Sepolia? (Chain ID: 11155111)
- Have Sepolia ETH for gas?
- Have Sepolia USDT tokens?

## Next Steps

- ✅ Contract deployed
- ✅ Backend configured
- ⏭️ Test full flow
- ⏭️ Deploy to BSC testnet
- ⏭️ Deploy to other chains
