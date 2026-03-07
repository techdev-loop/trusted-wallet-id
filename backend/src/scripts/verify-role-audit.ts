import { identityDb } from "../db/pool.js";

function readOption(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function run(): Promise<void> {
  const email = (readOption("--email") ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error("Missing required --email option");
  }

  const result = await identityDb.query<{
    email: string;
    previous_role: string | null;
    new_role: string;
    changed_by: string;
    changed_at: string;
  }>(
    `
      SELECT email, previous_role, new_role, changed_by, changed_at
      FROM user_role_changes
      WHERE email = $1
      ORDER BY changed_at DESC
      LIMIT 5
    `,
    [email]
  );

  console.log(JSON.stringify(result.rows, null, 2));
}

run()
  .catch((error) => {
    console.error("Role audit verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await identityDb.end();
  });
