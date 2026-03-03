CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  encrypted_identity_json TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_accepted_at TIMESTAMPTZ NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  provider_name TEXT NULL,
  provider_session_id TEXT NULL,
  provider_applicant_id TEXT NULL,
  provider_status TEXT NULL,
  provider_raw_result_json TEXT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  review_required BOOLEAN NOT NULL DEFAULT FALSE,
  last_error TEXT NULL,
  submitted_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE kyc_profiles
  ADD COLUMN IF NOT EXISTS provider_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS provider_session_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS provider_applicant_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS provider_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS provider_raw_result_json TEXT NULL,
  ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_profiles_provider_session_id
  ON kyc_profiles (provider_session_id)
  WHERE provider_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_profiles_provider_applicant_id
  ON kyc_profiles (provider_applicant_id)
  WHERE provider_applicant_id IS NOT NULL;
