import { Server as IOServer, Socket } from 'socket.io';
import { verifyToken } from '../config/jwt';
import logger from '../utils/logger';
export class SIGateway {
    static io = null;
    static init(server) {
        if (this.io)
            return this.io;
        this.io = new IOServer(server, {
            path: '/socket.io',
            cors: { origin: '*', credentials: true },
        });
        this.io.on('connection', (socket) => {
            try {
                const authHeader = socket.handshake.headers['authorization'];
                const authToken = socket.handshake.auth?.token;
                const queryToken = socket.handshake.query?.token;
                let token;
                if (authHeader?.startsWith('Bearer '))
                    token = authHeader.slice('Bearer '.length);
                else if (typeof authToken === 'string')
                    token = authToken;
                else if (typeof queryToken === 'string')
                    token = queryToken;
                if (token)
                    socket.data.user = verifyToken(token);
                else
                    socket.data.user = { avitag: null, role: 'GUEST' };
            }
            catch {
                socket.data.user = { avitag: null, role: 'GUEST' };
            }
            // Client can subscribe/unsubscribe to specific topics (rooms)
            socket.on('subscribe', ({ topic }) => {
                if (!topic || typeof topic !== 'string')
                    return;
                socket.join(`topic:${topic}`);
            });
            socket.on('unsubscribe', ({ topic }) => {
                if (!topic || typeof topic !== 'string')
                    return;
                socket.leave(`topic:${topic}`);
            });
            // Basic ping
            socket.on('ping', () => socket.emit('pong', { ts: Date.now() }));
        });
        logger.info('Socket.IO server initialized');
        return this.io;
    }
    static emit(topic, payload) {
        if (!this.io)
            return;
        const data = { topic, payload, ts: Date.now() };
        // Emit to topic room if any subscribers
        this.io.to(`topic:${topic}`).emit('broadcast', data);
        // Also emit to a global channel for clients who want everything
        this.io.emit('broadcast_all', data);
    }
}
