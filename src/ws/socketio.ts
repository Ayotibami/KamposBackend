import type { Server as HTTPServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { verifyToken } from '../config/jwt';
import { isAdminRole } from '../middleware/idiot';
import logger from '../utils/logger';

/** Room prefix reserved for admin-only broadcasts (moderation events, etc.)
 * — never joinable by a non-admin socket, see the `subscribe` handler
 * below, and never fanned out on the public `broadcast_all` channel, see
 * emitToAdmins(). Everything else under `topic:*` stays exactly as it was:
 * public, joinable by anyone, no auth check. */
const ADMIN_ROOM_PREFIX = 'admin:';

export class SIGateway {
  private static io: IOServer | null = null;

  static init(server: HTTPServer) {
    if (this.io) return this.io;
    this.io = new IOServer(server, {
      path: '/socket.io',
      cors: { origin: '*', credentials: true },
    });

    this.io.on('connection', (socket: Socket) => {
      try {
        const authHeader = socket.handshake.headers['authorization'] as string | undefined;
        const authToken = (socket.handshake.auth as any)?.token as string | undefined;
        const queryToken = (socket.handshake.query as any)?.token as string | undefined;
        let token: string | undefined;
        if (authHeader?.startsWith('Bearer ')) token = authHeader.slice('Bearer '.length);
        else if (typeof authToken === 'string') token = authToken;
        else if (typeof queryToken === 'string') token = queryToken;
        if (token) (socket.data as any).user = verifyToken(token);
        else (socket.data as any).user = { avitag: null, role: 'GUEST' };
      } catch {
        (socket.data as any).user = { avitag: null, role: 'GUEST' };
      }

      // Client can subscribe/unsubscribe to specific topics (rooms) —
      // except an `admin:*` topic, which is refused for anyone whose
      // verified-at-handshake identity isn't an admin. Silent no-op rather
      // than an error event, same as every other malformed-input case in
      // this handler — no signal is given either way about why a topic
      // didn't take, so a non-admin probing topic names learns nothing.
      socket.on('subscribe', ({ topic }: { topic: string }) => {
        if (!topic || typeof topic !== 'string') return;
        if (topic.startsWith(ADMIN_ROOM_PREFIX)) {
          const role = (socket.data as any)?.user?.role;
          if (!isAdminRole(role)) return;
        }
        socket.join(`topic:${topic}`);
      });
      socket.on('unsubscribe', ({ topic }: { topic: string }) => {
        if (!topic || typeof topic !== 'string') return;
        socket.leave(`topic:${topic}`);
      });

      // Basic ping
      socket.on('ping', () => socket.emit('pong', { ts: Date.now() }));
    });

    logger.info('Socket.IO server initialized');
    return this.io;
  }

  static emit(topic: string, payload: any) {
    if (!this.io) return;
    const data = { topic, payload, ts: Date.now() };
    // Emit to topic room if any subscribers
    this.io.to(`topic:${topic}`).emit('broadcast', data);
    // Also emit to a global channel for clients who want everything
    this.io.emit('broadcast_all', data);
  }

  /** Admin-only broadcast (moderation events: a new report, a gist entering
   * the pending queue, etc.) — deliberately NOT routed through emit()
   * above. emit() also fans every message out on `broadcast_all`, which
   * every connected socket receives regardless of room membership; that's
   * fine for public data (reactions, comment counts) but would leak
   * private moderation content (who reported what, and why) to any
   * visitor's open connection. This only ever reaches sockets sitting in
   * the `topic:admin:moderation` room, which `subscribe` above only lets
   * a verified admin join in the first place. */
  static emitToAdmins(topic: string, payload: any) {
    if (!this.io) return;
    const data = { topic, payload, ts: Date.now() };
    this.io.to(`topic:${ADMIN_ROOM_PREFIX}moderation`).emit('broadcast', data);
  }
}
