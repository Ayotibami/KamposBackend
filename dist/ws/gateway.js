"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSGateway = void 0;
const ws_1 = require("ws");
const jwt_1 = require("../config/jwt");
const logger_1 = __importDefault(require("../utils/logger"));
const gistRepo = __importStar(require("../modules/gist/gist.repo"));
const gist_service_1 = require("../modules/gist/gist.service");
const commentRepo = __importStar(require("../modules/comment/comment.repo"));
const reactionRepo = __importStar(require("../modules/reaction/reaction.repo"));
const pubsub_1 = require("../graphql/pubsub");
const socketio_1 = require("./socketio");
class WSGateway {
    static wss = null;
    static init(server) {
        if (this.wss)
            return this.wss;
        this.wss = new ws_1.WebSocketServer({ server, path: '/ws', perMessageDeflate: true });
        this.wss.on('connection', (ws, req) => {
            try {
                const auth = req.headers['authorization'];
                if (!auth || !auth.startsWith('Bearer ')) {
                    // Fake/guest auth: allow connection but no write privileges
                    const guest = { avitag: null, role: 'GUEST' };
                    ws.user = guest;
                    ws.send(JSON.stringify({ type: 'welcome', avitag: null }));
                }
                else {
                    const token = auth.slice('Bearer '.length);
                    const user = (0, jwt_1.verifyToken)(token);
                    ws.user = user;
                    ws.send(JSON.stringify({ type: 'welcome', avitag: user.avitag }));
                }
                // Handle incoming messages
                ws.on('message', async (raw) => {
                    try {
                        const msg = JSON.parse(String(raw || '{}'));
                        const type = msg?.type || '';
                        const requestId = msg?.requestId;
                        const user = ws.user;
                        if (!type)
                            return;
                        switch (type) {
                            case 'gist:view': {
                                const gist_id = msg?.gist_id;
                                if (!gist_id)
                                    return;
                                const avitag = user?.avitag ?? null;
                                await gistRepo.incrementView(gist_id, avitag);
                                // Broadcast a lightweight event; clients may refetch counts
                                WSGateway.broadcast('gist:viewed', { gist_id, by: avitag });
                                break;
                            }
                            // COMMENTS
                            case 'comments:create': {
                                const avitag = user?.avitag;
                                if (!avitag) {
                                    ws.send(JSON.stringify({ type: 'comments:create:error', requestId, message: 'Unauthorized' }));
                                    break;
                                }
                                const gist_id = msg?.gist_id;
                                const text = String(msg?.text || '').trim();
                                if (!gist_id || !text) {
                                    ws.send(JSON.stringify({ type: 'comments:create:error', requestId, message: 'gist_id and text required' }));
                                    break;
                                }
                                const created = await commentRepo.create({ gist_id, avitag, text });
                                ws.send(JSON.stringify({ type: 'comments:create:ok', requestId, data: created }));
                                WSGateway.broadcast('comment:created', { comment: created });
                                try {
                                    const counts = await gist_service_1.GistService.getCountsFull(gist_id);
                                    WSGateway.broadcast('counts:updated', { gist_id, ...counts });
                                }
                                catch { }
                                break;
                            }
                            case 'comments:get': {
                                const comment_id = msg?.comment_id;
                                if (!comment_id) {
                                    ws.send(JSON.stringify({ type: 'comments:get:error', requestId, message: 'comment_id required' }));
                                    break;
                                }
                                const c = await commentRepo.get(comment_id);
                                if (!c) {
                                    ws.send(JSON.stringify({ type: 'comments:get:error', requestId, message: 'Not found' }));
                                    break;
                                }
                                ws.send(JSON.stringify({ type: 'comments:get:ok', requestId, data: c }));
                                break;
                            }
                            case 'comments:list_by_gist': {
                                const gist_id = msg?.gist_id;
                                if (!gist_id) {
                                    ws.send(JSON.stringify({ type: 'comments:list_by_gist:error', requestId, message: 'gist_id required' }));
                                    break;
                                }
                                const limit = Number(msg?.limit ?? 20);
                                const cursor = typeof msg?.cursor === 'string' ? msg.cursor : undefined;
                                const data = await commentRepo.listByGist(gist_id, limit, cursor);
                                ws.send(JSON.stringify({ type: 'comments:list_by_gist:ok', requestId, data }));
                                break;
                            }
                            case 'comments:list_by_user': {
                                const targetAvitag = msg?.avitag;
                                if (!targetAvitag) {
                                    ws.send(JSON.stringify({ type: 'comments:list_by_user:error', requestId, message: 'avitag required' }));
                                    break;
                                }
                                const limit = Number(msg?.limit ?? 20);
                                const cursor = typeof msg?.cursor === 'string' ? msg.cursor : undefined;
                                const data = await commentRepo.listByUser(targetAvitag, limit, cursor);
                                ws.send(JSON.stringify({ type: 'comments:list_by_user:ok', requestId, data }));
                                break;
                            }
                            case 'comments:update': {
                                const avitag = user?.avitag;
                                if (!avitag) {
                                    ws.send(JSON.stringify({ type: 'comments:update:error', requestId, message: 'Unauthorized' }));
                                    break;
                                }
                                const comment_id = msg?.comment_id;
                                const text = String(msg?.text || '').trim();
                                if (!comment_id || !text) {
                                    ws.send(JSON.stringify({ type: 'comments:update:error', requestId, message: 'comment_id and text required' }));
                                    break;
                                }
                                const updated = await commentRepo.update(comment_id, avitag, text);
                                if (!updated) {
                                    ws.send(JSON.stringify({ type: 'comments:update:error', requestId, message: 'Not found or forbidden' }));
                                    break;
                                }
                                ws.send(JSON.stringify({ type: 'comments:update:ok', requestId, data: updated }));
                                WSGateway.broadcast('comment:updated', { comment: updated });
                                break;
                            }
                            case 'comments:delete': {
                                const avitag = user?.avitag;
                                const role = user?.role;
                                if (!avitag && role !== 'IDIOT') {
                                    ws.send(JSON.stringify({ type: 'comments:delete:error', requestId, message: 'Unauthorized' }));
                                    break;
                                }
                                const comment_id = msg?.comment_id;
                                if (!comment_id) {
                                    ws.send(JSON.stringify({ type: 'comments:delete:error', requestId, message: 'comment_id required' }));
                                    break;
                                }
                                const existing = await commentRepo.get(comment_id);
                                let ok = false;
                                if (role === 'IDIOT')
                                    ok = await commentRepo.removeAsAdmin(comment_id);
                                else
                                    ok = await commentRepo.remove(comment_id, avitag);
                                if (!ok) {
                                    ws.send(JSON.stringify({ type: 'comments:delete:error', requestId, message: 'Not found or forbidden' }));
                                    break;
                                }
                                ws.send(JSON.stringify({ type: 'comments:delete:ok', requestId }));
                                WSGateway.broadcast('comment:deleted', { comment_id });
                                if (existing?.gist_id) {
                                    try {
                                        const counts = await gist_service_1.GistService.getCountsFull(existing.gist_id);
                                        WSGateway.broadcast('counts:updated', { gist_id: existing.gist_id, ...counts });
                                    }
                                    catch { }
                                }
                                break;
                            }
                            // REACTIONS
                            case 'reactions:upsert': {
                                const avitag = user?.avitag;
                                if (!avitag) {
                                    ws.send(JSON.stringify({ type: 'reactions:upsert:error', requestId, message: 'Unauthorized' }));
                                    break;
                                }
                                const entity_type = msg?.entity_type;
                                const entity_id = msg?.entity_id;
                                const typeVal = msg?.type;
                                if (!entity_type || !entity_id || !typeVal) {
                                    ws.send(JSON.stringify({ type: 'reactions:upsert:error', requestId, message: 'entity_type, entity_id, type required' }));
                                    break;
                                }
                                const r = await reactionRepo.upsert({ avitag, entity_type, entity_id, type: typeVal });
                                ws.send(JSON.stringify({ type: 'reactions:upsert:ok', requestId, data: r }));
                                WSGateway.broadcast('reaction:upserted', { reaction: r });
                                if (entity_type === 'GIST') {
                                    try {
                                        const counts = await gist_service_1.GistService.getCountsFull(entity_id);
                                        WSGateway.broadcast('counts:updated', { gist_id: entity_id, ...counts });
                                    }
                                    catch { }
                                }
                                break;
                            }
                            case 'reactions:list_by_entity': {
                                const entity_type = msg?.entity_type;
                                const entity_id = msg?.entity_id;
                                if (!entity_type || !entity_id) {
                                    ws.send(JSON.stringify({ type: 'reactions:list_by_entity:error', requestId, message: 'entity_type and entity_id required' }));
                                    break;
                                }
                                const data = await reactionRepo.listByEntity(entity_type, entity_id);
                                ws.send(JSON.stringify({ type: 'reactions:list_by_entity:ok', requestId, data }));
                                break;
                            }
                            case 'reactions:list_by_user': {
                                const targetAvitag = msg?.avitag;
                                if (!targetAvitag) {
                                    ws.send(JSON.stringify({ type: 'reactions:list_by_user:error', requestId, message: 'avitag required' }));
                                    break;
                                }
                                const data = await reactionRepo.listByUser(targetAvitag);
                                ws.send(JSON.stringify({ type: 'reactions:list_by_user:ok', requestId, data }));
                                break;
                            }
                            case 'reactions:remove': {
                                const role = user?.role;
                                const reaction_id = msg?.reaction_id;
                                if (!reaction_id) {
                                    ws.send(JSON.stringify({ type: 'reactions:remove:error', requestId, message: 'reaction_id required' }));
                                    break;
                                }
                                // Allow IDIOT to remove any; otherwise fallback to composite removal below
                                if (role === 'IDIOT') {
                                    const ok = await reactionRepo.removeById(reaction_id);
                                    if (!ok) {
                                        ws.send(JSON.stringify({ type: 'reactions:remove:error', requestId, message: 'Not found' }));
                                        break;
                                    }
                                    ws.send(JSON.stringify({ type: 'reactions:remove:ok', requestId }));
                                    WSGateway.broadcast('reaction:removed', { reaction_id });
                                }
                                else {
                                    ws.send(JSON.stringify({ type: 'reactions:remove:error', requestId, message: 'Forbidden' }));
                                }
                                break;
                            }
                            case 'reactions:remove_by_entity': {
                                const avitag = user?.avitag;
                                if (!avitag) {
                                    ws.send(JSON.stringify({ type: 'reactions:remove_by_entity:error', requestId, message: 'Unauthorized' }));
                                    break;
                                }
                                const entity_type = msg?.entity_type;
                                const entity_id = msg?.entity_id;
                                if (!entity_type || !entity_id) {
                                    ws.send(JSON.stringify({ type: 'reactions:remove_by_entity:error', requestId, message: 'entity_type and entity_id required' }));
                                    break;
                                }
                                const ok = await reactionRepo.removeByComposite(entity_type, entity_id, avitag);
                                if (!ok) {
                                    ws.send(JSON.stringify({ type: 'reactions:remove_by_entity:error', requestId, message: 'Not found' }));
                                    break;
                                }
                                ws.send(JSON.stringify({ type: 'reactions:remove_by_entity:ok', requestId }));
                                WSGateway.broadcast('reaction:removed', { entity_type, entity_id, avitag });
                                if (entity_type === 'GIST') {
                                    try {
                                        const counts = await gist_service_1.GistService.getCountsFull(entity_id);
                                        WSGateway.broadcast('counts:updated', { gist_id: entity_id, ...counts });
                                    }
                                    catch { }
                                }
                                break;
                            }
                            case 'gists:list': {
                                const limit = Number(msg?.limit ?? 20);
                                const cursor = typeof msg?.cursor === 'string' ? msg.cursor : undefined;
                                const viewerAvitag = user?.avitag;
                                const data = await gist_service_1.GistService.listRecent(limit, cursor, viewerAvitag);
                                ws.send(JSON.stringify({ type: 'gists:list:ok', requestId, data }));
                                break;
                            }
                            case 'gists:get': {
                                const id = msg?.gist_id;
                                if (!id) {
                                    ws.send(JSON.stringify({ type: 'gists:get:error', requestId, message: 'gist_id required' }));
                                    break;
                                }
                                // Try approved first
                                const approved = await gist_service_1.GistService.findWithCounts(id);
                                if (approved) {
                                    ws.send(JSON.stringify({ type: 'gists:get:ok', requestId, data: approved }));
                                    break;
                                }
                                // Owner/admin can see unapproved
                                const full = await gist_service_1.GistService.findWithCountsAnyStatus(id);
                                if (!full) {
                                    ws.send(JSON.stringify({ type: 'gists:get:error', requestId, message: 'Not found' }));
                                    break;
                                }
                                const isOwner = user?.avitag && user.avitag === full.avitag;
                                const isAdmin = user?.role === 'IDIOT';
                                if (isOwner || isAdmin) {
                                    ws.send(JSON.stringify({ type: 'gists:get:ok', requestId, data: full }));
                                }
                                else {
                                    ws.send(JSON.stringify({ type: 'gists:get:error', requestId, message: 'Not found' }));
                                }
                                break;
                            }
                            case 'gists:by_user': {
                                const targetAvitag = msg?.avitag;
                                if (!targetAvitag) {
                                    ws.send(JSON.stringify({ type: 'gists:by_user:error', requestId, message: 'avitag required' }));
                                    break;
                                }
                                const limit = Number(msg?.limit ?? 20);
                                const cursor = typeof msg?.cursor === 'string' ? msg.cursor : undefined;
                                const viewerAvitag = user?.avitag;
                                const data = await gist_service_1.GistService.listByUser(targetAvitag, limit, cursor, viewerAvitag);
                                ws.send(JSON.stringify({ type: 'gists:by_user:ok', requestId, data }));
                                break;
                            }
                            case 'gists:trending': {
                                const limit = Number(msg?.limit ?? 20);
                                const viewerAvitag = user?.avitag;
                                const data = await gist_service_1.GistService.trending(limit, viewerAvitag);
                                ws.send(JSON.stringify({ type: 'gists:trending:ok', requestId, data }));
                                break;
                            }
                            case 'gists:search': {
                                const query = String(msg?.query || '').trim();
                                const limit = Number(msg?.limit ?? 20);
                                const offset = Number(msg?.offset ?? 0);
                                const viewerAvitag = user?.avitag;
                                const data = query ? await gist_service_1.GistService.search(query, limit, offset, viewerAvitag) : [];
                                ws.send(JSON.stringify({ type: 'gists:search:ok', requestId, data }));
                                break;
                            }
                            default:
                                break;
                        }
                    }
                    catch (e) {
                        // Ignore malformed messages
                    }
                });
            }
            catch (e) {
                // On parsing/verification error, continue as guest instead of closing
                const guest = { avitag: null, role: 'GUEST' };
                ws.user = guest;
                try {
                    ws.send(JSON.stringify({ type: 'welcome', avitag: null }));
                }
                catch { }
            }
        });
        logger_1.default.info('WebSocket server initialized');
        return this.wss;
    }
    static broadcast(topic, payload) {
        const message = JSON.stringify({ topic, payload, ts: Date.now() });
        if (this.wss) {
            this.wss.clients.forEach((client) => {
                if (client.readyState === ws_1.WebSocket.OPEN) {
                    client.send(message);
                }
            });
        }
        // Also publish to GraphQL subscriptions
        try {
            pubsub_1.PubSub.publish('broadcast', { topic, payload });
            pubsub_1.PubSub.publish(`broadcast:${topic}`, payload);
        }
        catch { }
        // Also emit to Socket.IO
        try {
            socketio_1.SIGateway.emit(topic, payload);
        }
        catch { }
    }
}
exports.WSGateway = WSGateway;
