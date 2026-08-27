import { Pool } from 'pg';
import logger from '../utils/logger';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.POSTGRES_URI,
  // Without these, a dead/unreachable DB (paused Neon project, network
  // partition) hangs every query indefinitely instead of failing — that
  // hang then propagates all the way up through whatever route triggered
  // it, with no ceiling, until something further up the chain times out
  // (e.g. Vercel killing a proxy/middleware invocation with a hard 504).
  connectionTimeoutMillis: 8000,
  statement_timeout: 8000,
});

export async function connectDB() {
  logger.info('Connecting to Postgres...');
  await pool.query('SELECT NOW()');
  logger.info('Postgres connected');
}
