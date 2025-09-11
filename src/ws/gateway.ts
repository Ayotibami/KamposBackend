import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { verifyToken } from '../config/jwt';
import logger from '../utils/logger';
import * as gistRepo from '../modules/gist/gist.repo';
import { GistService } from '../modules/gist/gist.service';

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
        // Handle incoming messages
        ws.on('message', async (raw) => {
          try {
            const msg = JSON.parse(String(raw || '{}'));
            const type: string = msg?.type || '';
            const requestId: string | undefined = msg?.requestId;
            if (!type) return;
            switch (type) {
              case 'gist:view': {
                const gist_id: string | undefined = msg?.gist_id;
                if (!gist_id) return;
                const avitag: string | null = (user as any)?.avitag ?? null;
                await gistRepo.incrementView(gist_id, avitag);
                // Broadcast a lightweight event; clients may refetch counts
                WSGateway.broadcast('gist:viewed', { gist_id, by: avitag });
                break;
              }
              case 'gists:list': {
                const limit = Number(msg?.limit ?? 20);
                const cursor = typeof msg?.cursor === 'string' ? msg.cursor : undefined;
                const viewerAvitag = (user as any)?.avitag as string | undefined;
                const data = await GistService.listRecent(limit, cursor, viewerAvitag);
                ws.send(JSON.stringify({ type: 'gists:list:ok', requestId, data }));
                break;
              }
              case 'gists:get': {
                const id: string | undefined = msg?.gist_id;
                if (!id) { ws.send(JSON.stringify({ type: 'gists:get:error', requestId, message: 'gist_id required' })); break; }
                // Try approved first
                const approved = await GistService.findWithCounts(id);
                if (approved) {
                  ws.send(JSON.stringify({ type: 'gists:get:ok', requestId, data: approved }));
                  break;
                }
                // Owner/admin can see unapproved
                const full = await GistService.findWithCountsAnyStatus(id);
                if (!full) { ws.send(JSON.stringify({ type: 'gists:get:error', requestId, message: 'Not found' })); break; }
                const isOwner = (user as any)?.avitag && (user as any).avitag === full.avitag;
                const isAdmin = (user as any)?.role === 'IDIOT';
                if (isOwner || isAdmin) {
                  ws.send(JSON.stringify({ type: 'gists:get:ok', requestId, data: full }));
                } else {
                  ws.send(JSON.stringify({ type: 'gists:get:error', requestId, message: 'Not found' }));
                }
                break;
              }
              case 'gists:by_user': {
                const targetAvitag: string | undefined = msg?.avitag;
                if (!targetAvitag) { ws.send(JSON.stringify({ type: 'gists:by_user:error', requestId, message: 'avitag required' })); break; }
                const limit = Number(msg?.limit ?? 20);
                const cursor = typeof msg?.cursor === 'string' ? msg.cursor : undefined;
                const viewerAvitag = (user as any)?.avitag as string | undefined;
                const data = await GistService.listByUser(targetAvitag, limit, cursor, viewerAvitag);
                ws.send(JSON.stringify({ type: 'gists:by_user:ok', requestId, data }));
                break;
              }
              case 'gists:trending': {
                const limit = Number(msg?.limit ?? 20);
                const viewerAvitag = (user as any)?.avitag as string | undefined;
                const data = await GistService.trending(limit, viewerAvitag);
                ws.send(JSON.stringify({ type: 'gists:trending:ok', requestId, data }));
                break;
              }
              case 'gists:search': {
                const query: string = String(msg?.query || '').trim();
                const limit = Number(msg?.limit ?? 20);
                const offset = Number(msg?.offset ?? 0);
                const viewerAvitag = (user as any)?.avitag as string | undefined;
                const data = query ? await GistService.search(query, limit, offset, viewerAvitag) : [];
                ws.send(JSON.stringify({ type: 'gists:search:ok', requestId, data }));
                break;
              }
              default:
                break;
            }
          } catch (e) {
            // Ignore malformed messages
          }
        });
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
