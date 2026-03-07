import { identityDb } from "../db/pool.js";

type AppRole = "user" | "admin" | "compliance";

interface CliOptions {
  email: string;
  role: AppRole;
}

function readOption(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function isValidRole(value: string): value is AppRole {
  return value === "user" || value === "admin" || value === "compliance";
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

  if (!isValidRole(roleValue)) {
    throw new Error("Invalid --role value. Use user, admin, or compliance.");
  }

  return {
    email: normalizedEmail,
    role: roleValue
  };
}

async function run(): Promise<void> {
  const options = parseCliOptions();

  const existingUserResult = await identityDb.query<{ id: string; role: AppRole }>(
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
    await identityDb.query(
      `
        UPDATE users
        SET role = $2
        WHERE id = $1
      `,
      [existingUser.id, options.role]
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

  console.log(`Created ${options.role} user ${options.email} with ID ${insertedUser.rows[0].id}.`);
}

run()
  .catch((error) => {
    console.error("Set role failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await identityDb.end();
  });
