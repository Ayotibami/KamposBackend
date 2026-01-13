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
const http_1 = __importDefault(require("http"));
const app_1 = __importStar(require("./app"));
const logger_1 = __importDefault(require("./utils/logger"));
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const redis_1 = require("./config/redis");
const socketio_1 = require("./ws/socketio");
const ws_1 = require("ws");
const ws_2 = require("graphql-ws/use/ws");
const graphql_1 = require("graphql");
const jwt_1 = require("./config/jwt");
async function main() {
    try {
        await (0, db_1.connectDB)();
        await (0, redis_1.connectRedis)();
        const server = http_1.default.createServer(app_1.default);
        // Socket.IO Gateway (standardized for realtime client usage)
        socketio_1.SIGateway.init(server);
        // GraphQL Subscriptions over WS at /graphql
        const gqlWSS = new ws_1.WebSocketServer({ server, path: '/graphql' });
        (0, ws_2.useServer)({
            schema: app_1.schema,
            execute: graphql_1.execute,
            subscribe: graphql_1.subscribe,
            roots: { subscription: app_1.root },
            context: async (ctx) => {
                // Handle auth from connectionParams.Authorization
                const auth = ctx.connectionParams?.Authorization || ctx.connectionParams?.authorization;
                if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
                    try {
                        const token = auth.slice('Bearer '.length);
                        const user = (0, jwt_1.verifyToken)(token);
                        return { user };
                    }
                    catch { }
                }
                return {};
            },
        }, gqlWSS);
        server.listen(env_1.env.PORT, () => {
            logger_1.default.info(`Server listening on http://localhost:${env_1.env.PORT}`);
        });
        const shutdown = async (signal) => {
            logger_1.default.info(`Shutting down${signal ? ` (${signal})` : ''}...`);
            server.close(async () => {
                try {
                    await db_1.pool.end();
                    await redis_1.redis.quit();
                }
                catch { }
                process.exit(0);
            });
        };
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('unhandledRejection', (reason) => {
            logger_1.default.error({ reason }, 'Unhandled Rejection');
        });
        process.on('uncaughtException', (err) => {
            logger_1.default.error({ err }, 'Uncaught Exception');
        });
    }
    catch (err) {
        logger_1.default.error({ err }, 'Fatal error during startup');
        try {
            await db_1.pool.end();
            await redis_1.redis.quit();
        }
        catch { }
        process.exit(1);
    }
}
main();
