# FIUlink

Private Web3 identity-linked wallet registry platform.

## Features

- **Email-based KYC**: Traditional email signup with OTP verification and KYC submission
- **Web3 Wallet Verification**: Direct wallet connection and 10 USDT payment for instant verification
- **Multi-Chain Support**: Ethereum, BSC, Tron, and Solana
- **Smart Contract Integration**: On-chain payment verification and registration

## Quick Start

### Web3 Wallet Flow (New)

1. Visit `/web3-wallet`
2. Select blockchain (Ethereum, BSC, Tron, or Solana)
3. Connect wallet
4. Approve USDT spending
5. Pay 10 USDT via smart contract
6. Wallet automatically verified

See [WEB3_IMPLEMENTATION.md](./WEB3_IMPLEMENTATION.md) for detailed setup.

### Traditional Email Flow

1. Sign up with email
2. Verify OTP
3. Complete KYC
4. Link wallet
5. Pay 10 USDT

## Full Stack Local Run

- Frontend `.env`: copy `.env.example` and set `VITE_API_BASE_URL` (default: `http://localhost:4000/api`)
- Backend setup details: see `backend/README.md`
- Start backend: `cd backend && npm run dev`
- Start frontend: `npm run dev`

## Frontend Stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Ethers.js (for Web3)

## Deploying on Vercel

- **Install:** The repo includes [`.npmrc`](./.npmrc) with `legacy-peer-deps=true`. `@solana/wallet-adapter-react` pulls optional React Native / mobile peers that disagree with **React 18** on the web; legacy peer resolution matches npm v6 behavior and avoids install failures.
- **Node:** Set the project to **Node 20.17+** or **22.x** (Vercel → Project → Settings → General → Node.js Version). The `engines` field in `package.json` guides compatible versions.
- **Build:** Default `npm install` + `npm run build` (Vite outputs `dist/`). Ensure `VITE_*` env vars are set in Vercel for production API URLs.