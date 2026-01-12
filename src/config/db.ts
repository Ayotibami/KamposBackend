import { Pool } from 'pg';
import logger from '../utils/logger';
import { env } from './env';

// Local development configuration
export const pool = new Pool({
  connectionString: env.POSTGRES_URI,
});

export async function connectDB() {
  logger.info('Connecting to Postgres...');
  await pool.query('SELECT NOW()');
  logger.info('Postgres connected');
}
