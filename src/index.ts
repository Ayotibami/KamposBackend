import http from 'http';
import app from './app';
import logger from './utils/logger';
import { env } from './config/env';
import { connectDB, pool } from './config/db';
import { connectRedis, redis } from './config/redis';
import { WSGateway } from './ws/gateway';

async function main() {
  try {
    await connectDB();
    await connectRedis();

    const server = http.createServer(app);
    WSGateway.init(server);

    server.listen(env.PORT, () => {
      logger.info(`Server listening on http://localhost:${env.PORT}`);
    });

    const shutdown = async (signal?: string) => {
      logger.info(`Shutting down${signal ? ` (${signal})` : ''}...`);
      server.close(async () => {
        try {
          await pool.end();
          await redis.quit();
        } catch {}
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('unhandledRejection', (reason: any) => {
      logger.error({ reason }, 'Unhandled Rejection');
    });
    process.on('uncaughtException', (err: any) => {
      logger.error({ err }, 'Uncaught Exception');
    });
  } catch (err) {
    logger.error({ err }, 'Fatal error during startup');
    try {
      await pool.end();
      await redis.quit();
    } catch {}
    process.exit(1);
  }
}

main();
