# Tron Smart Contract Integration

This document describes the Tron blockchain integration for FIUlink.

## Contract Information

- **Contract Address**: Set via `TRON_CONTRACT_ADDRESS` environment variable
- **Network**: Tron Shasta Testnet (default) or Mainnet
- **USDT Token**: 
  - Shasta Testnet: Set via `SHASTA_USDT_ADDRESS` (default: `TXYZopYRdj2D9XRtbG411XZZ3kM5VkA00B`)
  - Mainnet: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` (TRC20)
- **Contract ABI**: See provided ABI in project documentation

## Implementation Details

### Backend Changes

#### 1. TronWeb Integration
- Added `tronweb` package to backend dependencies
- Used for Tron blockchain interactions

#### 2. Transaction Verification (`verifyTronTransaction`)
Located in `backend/src/services/blockchain.service.ts`:

- Verifies Tron transactions by:
  1. Checking transaction exists and succeeded
  2. Validating contract address matches our WalletRegistry
  3. Finding USDT (TRC20) transfer to contract via:
     - Internal transactions (primary method)
     - Event logs (fallback method)
  4. Verifying transfer amount matches expected 10 USDT
  5. Extracting wallet address and transaction metadata

**Key Features:**
- Handles TRC20 Transfer events
- Supports both internal transactions and event log parsing
- Validates USDT amount (6 decimals)
- Returns transaction verification with block info

#### 3. Wallet Verification (`isWalletVerified`)
- Supports Tron contracts by:
  - Using TronWeb to connect to Tron network
  - Converting base58 addresses to hex format
  - Calling `isWalletVerified(address)` on the contract
  - Returning boolean verification status

#### 4. Address Normalization
- **Tron addresses**: Base58 encoded, case-sensitive (e.g., `TMCiUULbCGB2JLBcAxhU15Re8DrSqrCgoF`)
- **EVM addresses**: Hex encoded, case-insensitive (lowercased)
- Updated throughout codebase to handle both formats correctly

### Configuration

#### Environment Variables
Add to `backend/.env`:

**For Shasta Testnet (default):**
```env
TRON_CONTRACT_ADDRESS=<your-shasta-contract-address>
TRON_NETWORK=shasta
TRON_RPC_URL=https://api.shasta.trongrid.io
SHASTA_USDT_ADDRESS=<shasta-usdt-token-address>  # Optional, has default
```

**For Mainnet:**
```env
TRON_CONTRACT_ADDRESS=<your-mainnet-contract-address>
TRON_NETWORK=mainnet
TRON_RPC_URL=https://api.trongrid.io
```

#### Database Initialization
Run contract configuration initialization:

```bash
cd backend
npm run contracts:init
```

This will:
- Save Tron contract address to `contract_configs` table
- Configure USDT token address
- Set RPC URL and network name

### API Endpoints

All existing Web3 endpoints support Tron:

- `POST /api/web3/connect` - Connect Tron wallet
- `GET /api/web3/status/:walletAddress/tron` - Check verification status
- `GET /api/web3/contract-config/tron` - Get contract configuration

### Usage Example

#### Check Wallet Verification Status

```bash
# For Shasta testnet (addresses start with '27')
curl http://localhost:4000/api/web3/status/27xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/tron

# For Mainnet (addresses start with 'T')
curl http://localhost:4000/api/web3/status/TMCiUULbCGB2JLBcAxhU15Re8DrSqrCgoF/tron
```

Response:
```json
{
  "walletAddress": "27xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "chain": "tron",
  "verified": true
}
```

#### Get Contract Configuration

```bash
curl http://localhost:4000/api/web3/contract-config/tron
```

Response (Shasta testnet):
```json
{
  "chain": "tron",
  "contractAddress": "<your-shasta-contract-address>",
  "usdtTokenAddress": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkA00B",
  "networkName": "shasta"
}
```

## Technical Notes

### Tron Address Format
- Tron uses base58 encoding for addresses
- Addresses are case-sensitive
- Format: 
  - Mainnet: Starts with 'T' (e.g., `TMCiUULbCGB2JLBcAxhU15Re8DrSqrCgoF`)
  - Shasta Testnet: Starts with '27' (e.g., `27xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
- Always preserve case when handling Tron addresses

### TRC20 Token Transfers
- USDT on Tron is a TRC20 token
- 6 decimal places (same as USDT on other chains)
- Transfer events follow ERC20-like structure
- Internal transactions show token transfers when called from contracts

### Transaction Verification Flow
1. User calls `registerWallet()` on contract
2. Contract transfers 10 USDT from user to contract
3. Backend verifies transaction:
   - Checks transaction succeeded
   - Finds USDT transfer event/log
   - Validates amount (10 USDT = 10,000,000 sun)
   - Records in database

## Testing

### Prerequisites
- Tron wallet (TronLink, etc.)
- Tron Shasta testnet TRX and USDT tokens (for testnet)
- Backend running with Tron configuration
- Contract deployed on Shasta testnet

### Test Flow
1. Connect Tron wallet to frontend
2. Call `registerWallet()` on contract
3. Backend verifies transaction automatically
4. Check verification status via API

## Troubleshooting

### "Contract configuration not found"
- Run `npm run contracts:init` in backend
- Check `.env` has `TRON_CONTRACT_ADDRESS` set

### "Transaction not found"
- Verify transaction hash is correct
- Check transaction is confirmed on Tron network
- Ensure RPC URL is accessible

### "USDT transfer not found"
- Verify transaction called `registerWallet()`
- Check USDT was transferred to contract
- Review transaction logs for Transfer events

### Address Format Issues
- Ensure Tron addresses are in base58 format
- Don't lowercase Tron addresses
- Validate address format before API calls

## Future Enhancements

- [x] Support Tron testnet (Shasta) ✅
- [ ] Add Tron wallet connection in frontend
- [ ] Implement Tron transaction signing
- [ ] Add Tron-specific error handling
- [ ] Support other TRC20 tokens
