-- Opaque refresh tokens for /web3/connect wallet_users sessions (separate from identity DB).

CREATE TABLE IF NOT EXISTS web3_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_user_id UUID NOT NULL REFERENCES wallet_users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT web3_refresh_tokens_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_web3_refresh_tokens_wallet_user_id ON web3_refresh_tokens (wallet_user_id);
CREATE INDEX IF NOT EXISTS idx_web3_refresh_tokens_expires_at ON web3_refresh_tokens (expires_at);
