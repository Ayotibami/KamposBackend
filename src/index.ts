import http from 'http';
import app, { schema, root } from './app';
import logger from './utils/logger';
import { env } from './config/env';
import { connectDB, pool } from './config/db';
import { connectRedis, redis } from './config/redis';
import { WSGateway } from './ws/gateway';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { execute, subscribe, GraphQLSchema } from 'graphql';
import { verifyToken } from './config/jwt';

async function main() {
  try {
    await connectDB();
    await connectRedis();

    const server = http.createServer(app);
    // WS Gateway for app events
    WSGateway.init(server);

    // GraphQL Subscriptions over WS at /graphql
    const gqlWSS = new WebSocketServer({ server, path: '/graphql' });
    useServer({
      schema: schema as GraphQLSchema,
      execute,
      subscribe,
      roots: { subscription: root as any },
      context: async (ctx) => {
        // Handle auth from connectionParams.Authorization
        const auth = (ctx.connectionParams as any)?.Authorization || (ctx.connectionParams as any)?.authorization;
        if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
          try {
            const token = auth.slice('Bearer '.length);
            const user = verifyToken(token);
            return { user };
          } catch {}
        }
        return {};
      },
    }, gqlWSS);

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
