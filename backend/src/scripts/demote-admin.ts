import { identityDb } from "../db/pool.js";

type PrivilegedRole = "admin" | "compliance";
type TargetRole = "user";

interface CliOptions {
  email: string;
  role: TargetRole;
  changedBy: string;
}

function readOption(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function parseCliOptions(): CliOptions {
  const email = readOption("--email");
  const roleValue = readOption("--role") ?? "user";
  const changedByValue = (readOption("--changed-by") ?? "system:script").trim();

  if (!email) {
    throw new Error("Missing required --email option");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) {
    throw new Error("Invalid --email value");
  }

  if (roleValue !== "user") {
    throw new Error("Invalid --role value. Use user.");
  }
  if (!changedByValue) {
    throw new Error("Invalid --changed-by value");
  }

  return {
    email: normalizedEmail,
    role: roleValue,
    changedBy: changedByValue
  };
}

function isPrivilegedRole(role: string): role is PrivilegedRole {
  return role === "admin" || role === "compliance";
}

async function run(): Promise<void> {
  const options = parseCliOptions();

  const existingUserResult = await identityDb.query<{ id: string; role: string }>(
    `
      SELECT id, role
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [options.email]
  );

  const existingUser = existingUserResult.rows[0];

  if (!existingUser) {
    throw new Error(`User not found for email ${options.email}`);
  }

  if (!isPrivilegedRole(existingUser.role)) {
    throw new Error(
      `Cannot demote user ${options.email} (${existingUser.id}) because current role is ${existingUser.role}.`
    );
  }

  await identityDb.query(
    `
      UPDATE users
      SET role = $2
      WHERE id = $1
    `,
    [existingUser.id, options.role]
  );
  await identityDb.query(
    `
      INSERT INTO user_role_changes (
        user_id,
        email,
        previous_role,
        new_role,
        changed_by,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      existingUser.id,
      options.email,
      existingUser.role,
      options.role,
      options.changedBy,
      JSON.stringify({ source: "admin:demote", action: "update" })
    ]
  );

  console.log(
    `Demoted user ${options.email} (${existingUser.id}) role from ${existingUser.role} to ${options.role}.`
  );
}

run()
  .catch((error) => {
    console.error("Admin demotion failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await identityDb.end();
  });
