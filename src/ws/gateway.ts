import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { verifyToken } from '../config/jwt';
import logger from '../utils/logger';

export class WSGateway {
  private static wss: WebSocketServer | null = null;

  static init(server: Server) {
    if (this.wss) return this.wss;
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket, req) => {
      try {
        const auth = req.headers['authorization'] as string | undefined;
        if (!auth || !auth.startsWith('Bearer ')) {
          ws.close(4401, 'Unauthorized');
          return;
        }
        const token = auth.slice('Bearer '.length);
        const user = verifyToken(token);
        (ws as any).user = user;
        ws.send(JSON.stringify({ type: 'welcome', avitag: user.avitag }));
      } catch (e) {
        ws.close(4401, 'Invalid token');
      }
    });

    logger.info('WebSocket server initialized');
    return this.wss;
  }

  static broadcast(topic: string, payload: any) {
    if (!this.wss) return;
    const message = JSON.stringify({ topic, payload, ts: Date.now() });
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}
