import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { identityDb, walletDb } from "../db/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run(): Promise<void> {
  const identitySchemaPath = path.resolve(__dirname, "../../sql/identity_schema.sql");
  const walletSchemaPath = path.resolve(__dirname, "../../sql/wallet_schema.sql");

  const [identitySql, walletSql] = await Promise.all([
    readFile(identitySchemaPath, "utf8"),
    readFile(walletSchemaPath, "utf8")
  ]);

  await identityDb.query(identitySql);
  await walletDb.query(walletSql);

  console.log("Database schemas initialized successfully.");
}

run()
  .catch((error) => {
    console.error("Failed to initialize database schemas:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([identityDb.end(), walletDb.end()]);
  });
