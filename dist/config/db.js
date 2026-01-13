"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.connectDB = connectDB;
const pg_1 = require("pg");
const logger_1 = __importDefault(require("../utils/logger"));
const env_1 = require("./env");
exports.pool = new pg_1.Pool({ connectionString: env_1.env.POSTGRES_URI });
async function connectDB() {
    logger_1.default.info('Connecting to Postgres...');
    await exports.pool.query('SELECT NOW()');
    logger_1.default.info('Postgres connected');
}
