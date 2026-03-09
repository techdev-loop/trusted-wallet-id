# Tron Shasta Testnet Setup

Quick setup guide for Tron Shasta testnet integration.

## Step 1: Update Backend .env

Edit `backend/.env` and add:

```env
# Tron Shasta Testnet
TRON_CONTRACT_ADDRESS=<your-shasta-contract-address>
TRON_NETWORK=shasta
TRON_RPC_URL=https://api.shasta.trongrid.io
SHASTA_USDT_ADDRESS=<shasta-usdt-token-address>
```

**Important Notes:**
- Replace `<your-shasta-contract-address>` with your deployed contract address on Shasta
- Replace `<shasta-usdt-token-address>` with the USDT token address on Shasta testnet
- If `SHASTA_USDT_ADDRESS` is not set, a default placeholder will be used (you should update this)

## Step 2: Initialize Contract Configuration

```bash
cd backend
npm run contracts:init
```

Expected output:
```
✓ Configured tron contract
Contract configurations initialized successfully!
```

## Step 3: Verify Configuration

### Check Database
```sql
SELECT * FROM contract_configs WHERE chain = 'tron';
```

Expected output:
- chain: `tron`
- contract_address: `<your-shasta-contract-address>`
- usdt_token_address: `<shasta-usdt-token-address>`
- network_name: `shasta`
- rpc_url: `https://api.shasta.trongrid.io`

### Check API
```bash
curl http://localhost:4000/api/web3/contract-config/tron
```

Should return:
```json
{
  "chain": "tron",
  "contractAddress": "<your-shasta-contract-address>",
  "usdtTokenAddress": "<shasta-usdt-token-address>",
  "networkName": "shasta"
}
```

## Shasta Testnet Details

- **Network Name**: Shasta
- **RPC URL**: `https://api.shasta.trongrid.io`
- **Block Explorer**: https://shasta.tronscan.org
- **Faucet**: https://www.trongrid.io/faucet
- **Address Format**: Starts with `27` (not `T` like mainnet)

## Getting Testnet Tokens

1. **Get Shasta TRX**: Visit https://www.trongrid.io/faucet
2. **Get Shasta USDT**: You may need to deploy a test USDT token or use an existing testnet token

## Testing

1. Deploy your contract to Shasta testnet
2. Update `TRON_CONTRACT_ADDRESS` in `.env`
3. Run `npm run contracts:init`
4. Test wallet connection and verification

## Troubleshooting

**"Contract address not found"**
- Make sure `TRON_CONTRACT_ADDRESS` is set in `.env`
- Run `npm run contracts:init` again

**"Transaction not found"**
- Verify you're using Shasta testnet RPC: `https://api.shasta.trongrid.io`
- Check transaction exists on https://shasta.tronscan.org

**"USDT transfer not found"**
- Verify the USDT token address is correct for Shasta
- Check that the token contract exists on Shasta testnet

## Switching Between Networks

To switch from Shasta to Mainnet:

```env
TRON_NETWORK=mainnet
TRON_RPC_URL=https://api.trongrid.io
TRON_CONTRACT_ADDRESS=<mainnet-contract-address>
```

Then run `npm run contracts:init` again.
