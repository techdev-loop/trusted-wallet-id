import { identityDb } from "../db/pool.js";

type BootstrapRole = "admin" | "compliance";

interface CliOptions {
  email: string;
  role: BootstrapRole;
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
  const roleValue = readOption("--role") ?? "admin";
  const changedByValue = (readOption("--changed-by") ?? "system:script").trim();

  if (!email) {
    throw new Error("Missing required --email option");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) {
    throw new Error("Invalid --email value");
  }

  if (roleValue !== "admin" && roleValue !== "compliance") {
    throw new Error("Invalid --role value. Use admin or compliance.");
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

  if (existingUser) {
    const previousRole = existingUser.role;
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
        previousRole,
        options.role,
        options.changedBy,
        JSON.stringify({ source: "admin:bootstrap", action: "update" })
      ]
    );
    console.log(
      `Updated user ${options.email} (${existingUser.id}) role from ${existingUser.role} to ${options.role}.`
    );
    return;
  }

  const insertedUser = await identityDb.query<{ id: string }>(
    `
      INSERT INTO users (email, role)
      VALUES ($1, $2)
      RETURNING id
    `,
    [options.email, options.role]
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
      insertedUser.rows[0].id,
      options.email,
      null,
      options.role,
      options.changedBy,
      JSON.stringify({ source: "admin:bootstrap", action: "create" })
    ]
  );

  console.log(`Created ${options.role} user ${options.email} with ID ${insertedUser.rows[0].id}.`);
}

run()
  .catch((error) => {
    console.error("Admin bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await identityDb.end();
  });
