-- Admin RBAC: optional password login + capability grants per admin/compliance user.

ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_password_hash TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_capabilities TEXT[] NULL;

COMMENT ON COLUMN users.admin_password_hash IS 'bcrypt hash; NULL means password login not enabled for this user.';
COMMENT ON COLUMN users.admin_capabilities IS 'NULL = legacy full access for admin/compliance; empty = no admin API access; explicit list = RBAC.';

-- Backfill: existing privileged users keep full access.
UPDATE users
SET admin_capabilities = ARRAY['*']::text[]
WHERE role IN ('admin', 'compliance')
  AND admin_capabilities IS NULL;
