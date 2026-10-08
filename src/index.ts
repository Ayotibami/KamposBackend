import http from 'http';
import app, { schema, root } from './app';
import logger from './utils/logger';
import { env } from './config/env';
import { connectDB, pool } from './config/db';
import { connectRedis, redis } from './config/redis';
import { WSGateway } from './ws/gateway';
import { SIGateway } from './ws/socketio';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { execute, subscribe, GraphQLSchema } from 'graphql';
import { verifyToken } from './config/jwt';
import cron from 'node-cron';
import { runDigest } from './modules/idiot/digest';
import { processPendingBroadcastRecipients } from './modules/idiot/broadcastSender';
import { sweepExpiredHotPosts } from './modules/hot/hot.sweep';
import { runDigestBatch, checkHotExpiring, runInactivityNudges, runActivationNudges, cleanupOld as cleanupOldNotifications } from './modules/notification/notification.service';

async function main() {
  try {
    await connectDB();
    // Not awaited on purpose — Redis connecting can hang indefinitely (a
    // dead/unreachable host, like a stale hostname, never settles the
    // connect() promise), and this previously blocked the entire server
    // from starting, which is what timed out a whole deploy. The server
    // should come up regardless; auth degrades gracefully without Redis
    // (see token.service.ts) rather than the API being unreachable.
    connectRedis();

    const server = http.createServer(app);

    // Raw WebSocket gateway at /ws — this is the ONLY realtime channel the
    // frontend actually speaks (src/lib/ws.ts's WSClient), and the one
    // WSGateway.broadcast() sends over for gist/comment/reaction live
    // updates. Missing here meant nothing ever handled the /ws upgrade
    // request at all — the browser's handshake got a bare 400, the raw
    // WebSocket never connected, and every WSGateway.broadcast() call's
    // `if (this.wss)` guard silently no-opped every single time, with no
    // error anywhere. The other two channels below (Socket.IO, GraphQL
    // subscriptions) kept working fine, which is exactly why this had no
    // visible symptom until something specifically depended on the raw
    // /ws path.
    WSGateway.init(server);

    // Socket.IO Gateway (standardized for realtime client usage)
    SIGateway.init(server);

    // GraphQL Subscriptions over WS at /graphql — deliberately on its OWN
    // HTTP server/port, not sharing `server` with the raw /ws gateway and
    // Socket.IO above. This isn't stylistic: graphql-ws's `useServer` ws
    // adapter has a confirmed, reproducible bug where merely initializing
    // it against a shared server corrupts OTHER, completely unrelated
    // WebSocket connections on that same server — every message after the
    // first one sent by WSGateway started arriving with an invalid frame
    // (RSV1 set with no extension negotiated), which every compliant
    // client correctly rejects and disconnects on. Confirmed by isolating
    // each piece one at a time: Express + WSGateway alone = clean, adding
    // Socket.IO = still clean, adding graphql-ws's useServer (any version,
    // any `ws` version, with or without its own keepAlive) = breaks
    // immediately. Moving it to its own server here is what actually fixed
    // it. Nothing in this app currently uses GraphQL subscriptions from the
    // frontend (only the raw /ws gateway is wired up client-side), so this
    // has no user-facing effect beyond making the real-time gateway work
    // at all.
    const GQL_WS_PORT = env.PORT + 1;
    const gqlServer = http.createServer();
    const gqlWSS = new WebSocketServer({ server: gqlServer, path: '/graphql' });
    useServer({
      schema: schema as GraphQLSchema,
      execute,
      subscribe,
      roots: { subscription: root as any },
      context: async (ctx: any) => {
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
    gqlServer.listen(GQL_WS_PORT, () => {
      logger.info(`GraphQL subscriptions listening on ws://localhost:${GQL_WS_PORT}/graphql`);
    });

    server.listen(env.PORT, () => {
      logger.info(`Server listening on http://localhost:${env.PORT}`);
    });

    // Admin activity digest — see digest.ts's own doc comment. Runs on the
    // clock (":00"/":30" past the hour), not "every 30 minutes from
    // whenever this process happened to boot" — a fixed clock means a
    // redeploy doesn't shift the schedule around.
    cron.schedule('0,30 * * * *', () => {
      void runDigest();
    });

    // Broadcast email sender — a batch a minute (see broadcastSender.ts's
    // own doc comment). This same recurring tick is what lets a broadcast
    // that hit the email provider's daily quota resume on its own the
    // moment that quota resets, with nobody needing to remember to retry it.
    cron.schedule('* * * * *', () => {
      void processPendingBroadcastRecipients();
    });

    // Hot post cleanup — see hot.sweep.ts's own doc comment: this is pure
    // storage hygiene, not what makes a post actually disappear (that's
    // already handled by every read query's own WHERE clause). Hourly, 15
    // past the hour so it never lands on the exact same tick as the digest
    // job above.
    cron.schedule('15 * * * *', () => {
      void sweepExpiredHotPosts();
    });

    // Notification digest batcher — fixed clock, 8 runs a day (every 3
    // hours), matching the product spec's own digest cap exactly (24 ÷ 3 =
    // 8). Each run bundles whatever's piled up in notification_events
    // since the last one into a single notification per recipient.
    cron.schedule('0 0,3,6,9,12,15,18,21 * * *', () => {
      // runDigestBatch already isolates failures per-recipient internally —
      // this catch is a last line of defense against the function's own
      // top-level query (findPendingDigestEvents) failing, so a DB hiccup
      // here logs instead of becoming an unhandled rejection.
      runDigestBatch().catch((err) => logger.error({ err }, 'runDigestBatch: top-level failure'));
    });

    // Hot-post-about-to-expire check — every 15 min, frequent enough that
    // the "<2h left" window (the same threshold the rail's own urgency
    // badge uses) never gets missed between ticks.
    cron.schedule('*/15 * * * *', () => {
      void checkHotExpiring();
    });

    // Periodic nudges — once a day is enough for both: the inactivity
    // nudge only cares about 3-day-old inactivity (a day's slop doesn't
    // matter), and the activation nudge gates itself to the 12pm-4pm
    // window internally regardless of when this tick lands.
    cron.schedule('0 9 * * *', () => {
      void runInactivityNudges();
    });
    cron.schedule('0 13 * * *', () => {
      void runActivationNudges();
    });

    // 30-day notification cleanup — same storage-hygiene reasoning as
    // hot.sweep.ts's own job, just for notifications instead of Hot posts.
    cron.schedule('30 4 * * *', () => {
      void cleanupOldNotifications();
    });

    const shutdown = async (signal?: string) => {
      logger.info(`Shutting down${signal ? ` (${signal})` : ''}...`);
      server.close(async () => {
        gqlServer.close();
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
