import { Pool } from "pg";
import { env } from "./env.config";
import logger from "../utils/logger";

const pool = new Pool({
  connectionString: env.POSTGRES_URI,

  ssl: env.POSTGRES_URI?.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000,
});

export const connectDB = async (): Promise<void> => {
  try {
    logger.info("Connecting to Postgres...");
    await pool.query("SELECT NOW()");
    logger.info("Postgres connected!");
  } catch (error: any) {
    logger.error("Postgres connection error:", error);
    throw error;
  }
};

export default pool;
