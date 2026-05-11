-- Grant full admin RBAC (wildcard) to vadymyashen@gmail.com so they can manage team
-- permissions and remove other operators (requires operators:delete, satisfied by *).
-- Run against the identity database (same DB as `users`).
-- If no row is updated, create the operator first (e.g. backend bootstrap-admin script).

UPDATE users
SET admin_capabilities = ARRAY['*']::text[]
WHERE lower(trim(email)) = 'vadymyashen@gmail.com'
  AND role IN ('admin', 'compliance');
