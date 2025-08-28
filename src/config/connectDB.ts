import { Pool } from "pg";
import { env } from "./env.config";
import logger from "../utils/logger";

const pool = new Pool({
  connectionString: env.POSTGRES_URI,
  ssl: {
    rejectUnauthorized: false,
  },
  // optional pool settings
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const connectDB = async (): Promise<void> => {
  try {
    logger.info("Connecting to Postgres...");
    await pool.query("SELECT NOW()"); // simple query to check connection
    logger.info("Postgres connected!");
  } catch (error: any) {
    logger.error("Postgres connection error:", error);
    throw error;
  }
};

export default pool;
