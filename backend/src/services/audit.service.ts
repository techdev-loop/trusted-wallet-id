import { walletDb } from "../db/pool.js";

interface AuditLogInput {
  actorUserId: string;
  actorRole: string;
  action: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}

export async function logAdminAudit(input: AuditLogInput): Promise<void> {
  await walletDb.query(
    `
      INSERT INTO admin_audit_logs (
        actor_user_id,
        actor_role,
        action,
        target_user_id,
        metadata_json
      ) VALUES ($1, $2, $3, $4, $5)
    `,
    [
      input.actorUserId,
      input.actorRole,
      input.action,
      input.targetUserId ?? null,
      JSON.stringify(input.metadata ?? {})
    ]
  );
}
