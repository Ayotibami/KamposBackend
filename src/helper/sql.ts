import pool, { connectDB } from "../config/connectDB";
import logger from "../utils/logger";

/**
 * Edit the SQL below as needed, then run this file once to apply it to the deployed Postgres.
 */
const sql = `
-- users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  user_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  roles TEXT[] DEFAULT ARRAY['user'],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- otps table
CREATE TABLE IF NOT EXISTS otps (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otps_created_at ON otps(created_at);
`;

/**
 * Run provided SQL against the configured Postgres pool.
 * The script will call connectDB (a quick connectivity test) then run the SQL and close the pool.
 */
export async function runSqlScript(sqlToRun: string): Promise<void> {
  try {
    await connectDB(); // verifies connection
    logger.info("Running SQL script...");
    await pool.query(sqlToRun);
    logger.info("SQL script executed successfully.");
  } catch (error: any) {
    logger.error("Error executing SQL script:", error);
    throw error;
  } finally {
    try {
      await pool.end();
      logger.info("Postgres pool closed.");
    } catch (err) {
      // ignore
    }
  }
}

/**
 * If this file is executed directly (npx ts-node ...), run the built-in SQL.
 */
if (require.main === module) {
  (async () => {
    try {
      await runSqlScript(sql);
      process.exit(0);
    } catch {
      process.exit(1);
    }
  })();
}
