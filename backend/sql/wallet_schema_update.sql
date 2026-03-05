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
