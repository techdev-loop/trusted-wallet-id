import { identityDb } from "../db/pool.js";

type PrivilegedRole = "admin" | "compliance";
type TargetRole = "user";

interface CliOptions {
  email: string;
  role: TargetRole;
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

  return {
    email: normalizedEmail,
    role: roleValue
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
