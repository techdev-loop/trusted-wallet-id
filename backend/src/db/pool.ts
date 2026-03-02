import { Pool } from "pg";
import { env } from "../config/env.js";

export const identityDb = new Pool({
  connectionString: env.IDENTITY_DATABASE_URL,
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false
});

export const walletDb = new Pool({
  connectionString: env.WALLET_DATABASE_URL,
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false
});
