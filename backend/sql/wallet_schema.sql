CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS wallet_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wallet_address TEXT NOT NULL,
  message_nonce TEXT NOT NULL,
  link_status TEXT NOT NULL DEFAULT 'pending_payment',
  linked_at TIMESTAMPTZ NULL,
  unlinked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wallet_address)
);

CREATE TABLE IF NOT EXISTS fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_link_id UUID NOT NULL REFERENCES wallet_links (id) ON DELETE CASCADE,
  amount_usdt NUMERIC(12, 2) NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disclosure_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wallet_address TEXT NOT NULL,
  lawful_request_reference TEXT NOT NULL,
  approved_by_user BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_admin_user_id UUID NOT NULL,
  approved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id UUID NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
