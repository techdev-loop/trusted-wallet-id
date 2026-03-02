# FIUlink Backend

Private identity-linked wallet registry backend for FIUlink.

## Core Architecture

- **Framework:** Express + TypeScript
- **Auth:** Email OTP login + JWT
- **Encryption:** AES-256-GCM for identity payload storage
- **Databases:** Two separate PostgreSQL instances
  - Identity DB (`users`, `otp_challenges`, `kyc_profiles`)
  - Wallet Mapping DB (`wallet_links`, `fee_payments`, `disclosure_requests`, `disclosure_logs`, `admin_audit_logs`)
- **RBAC Roles:** `user`, `admin`, `compliance`

## Security and Compliance Features

- TLS assumed at deployment edge and secure DB connections in production.
- Identity data encrypted at rest before database write.
- Consent required before KYC submission.
- Restricted identity-view endpoint for compliance role only.
- Immutable-style admin audit trail via append-only `admin_audit_logs`.
- Legal notices endpoint includes non-government affiliation disclaimer and retention/disclosure policy statements.

## Setup

1. Copy environment template:
   - `cp .env.example .env` (or create `.env` manually on Windows)
2. Fill secure values for `JWT_SECRET` and `AES_256_KEY`.
3. Install dependencies:
   - `npm install`
4. Initialize DB schema in both databases:
   - `npm run db:init`
5. Start development server:
   - `npm run dev`

## Admin Bootstrap

Create or promote a user as `admin` or `compliance`:

- `npm run admin:bootstrap -- --email admin@fiulink.com --role admin`
- `npm run admin:bootstrap -- --email compliance@fiulink.com --role compliance`

Notes:
- Run this after `npm run db:init`.
- If the email already exists, the role is updated.

## API Entry Points

- `GET /api/health`
- `GET /api/legal/notices`
- `POST /api/auth/signup`
- `POST /api/auth/verify-otp`
- `POST /api/kyc/submit`
- `POST /api/wallet/link/initiate`
- `POST /api/wallet/link/confirm`
- `POST /api/payments/confirm`
- `GET /api/dashboard`
- `POST /api/dashboard/wallets/:walletAddress/unlink`
- `GET /api/admin/users/by-wallet/:walletAddress`
- `GET /api/admin/identity/:userId` (compliance role only)
- `POST /api/admin/disclosures`
- `POST /api/admin/disclosures/:disclosureRequestId/approve`
- `GET /api/admin/audit-logs`

## Typical Wallet Linking Flow

1. User signs up with email and receives OTP.
2. User verifies OTP and receives bearer token.
3. User submits KYC data with explicit consent.
4. User initiates wallet linking and signs challenge message.
5. User confirms 10 USDT payment to activate identity-linked status.
