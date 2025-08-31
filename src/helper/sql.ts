import pool, { connectDB } from "../config/connectDB";
import logger from "../utils/logger";

export const sql = `
  ALTER TABLE oauth_sessions
DROP CONSTRAINT oauth_sessions_auth_provider_check;
`;

export async function runSqlScript(sql: string): Promise<void> {
  try {
    await connectDB();
    logger.info("Running SQL script...");
    await pool.query(sql);
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
