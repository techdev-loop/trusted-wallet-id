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
   - For local frontend ports, set `ALLOWED_ORIGINS` (comma-separated, e.g. `http://localhost:8080,http://localhost:8081`)
3. Install dependencies:
   - `npm install`
4. Initialize DB schema in both databases:
   - `npm run db:init`
5. Start development server:
   - `npm run dev`

## OTP Email (Resend)

- Default behavior: `EMAIL_PROVIDER=none` (OTP is returned in response during non-production for local development)
- To enable Resend:
  - Set `EMAIL_PROVIDER=resend`
  - Set `RESEND_API_KEY=<your-resend-api-key>`
  - Set `OTP_EMAIL_FROM` (for dev/staging, `onboarding@resend.dev` can be used)
- When Resend is enabled, OTP is not exposed in API response.

## KYC Provider (Didit)

- Set `KYC_PROVIDER=didit` to enable provider-backed KYC.
- Required values:
  - `DIDIT_API_KEY`
  - `DIDIT_FLOW_ID`
  - `DIDIT_WEBHOOK_SECRET`
- Optional:
  - `DIDIT_BASE_URL` (defaults to `https://api.didit.me`)

### Didit webhook setup

- Configure Didit webhook URL to:
  - `POST /api/kyc/webhooks/didit`
- Use a public tunnel in local development (for example ngrok) and set webhook URL to your tunnel domain.
- Webhook signatures are validated using `DIDIT_WEBHOOK_SECRET` before state updates are applied.

## Admin Bootstrap

Create or promote a user as `admin` or `compliance`:

- `npm run admin:bootstrap -- --email admin@fiulink.com --role admin`
- `npm run admin:bootstrap -- --email compliance@fiulink.com --role compliance`

Demote a privileged account back to `user`:

- `npm run admin:demote -- --email admin@fiulink.com --role user`

Unified role management (recommended):

- `npm run admin:set-role -- --email admin@fiulink.com --role admin`
- `npm run admin:set-role -- --email compliance@fiulink.com --role compliance`
- `npm run admin:set-role -- --email user@fiulink.com --role user`

Optional operator metadata for auditing:

- `npm run admin:set-role -- --email admin@fiulink.com --role admin --changed-by ops@fiulink.com`

Notes:
- Run this after `npm run db:init`.
- If the email already exists, the role is updated.
- Demotion only works for existing `admin`/`compliance` users.
- Role changes are written to `user_role_changes` in Identity DB.

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
