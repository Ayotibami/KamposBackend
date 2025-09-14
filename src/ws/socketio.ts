import type { Server as HTTPServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { verifyToken } from '../config/jwt';
import logger from '../utils/logger';

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

      // Client can subscribe/unsubscribe to specific topics (rooms)
      socket.on('subscribe', ({ topic }: { topic: string }) => {
        if (!topic || typeof topic !== 'string') return;
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
}
