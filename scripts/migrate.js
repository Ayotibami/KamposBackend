"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pg_1 = require("pg");
const MIGRATIONS_DIR = path_1.default.resolve(process.cwd(), "migrations");
async function run() {
    const { POSTGRES_URI } = process.env;
    if (!POSTGRES_URI) {
        console.error("POSTGRES_URI is not set in the environment");
        process.exit(1);
    }
    const client = new pg_1.Client({ connectionString: POSTGRES_URI });
    try {
        await client.connect();
        // Ensure migrations table exists
        await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        const files = fs_1.default
            .readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith(".sql"))
            .sort();
        const applied = new Set();
        const res = await client.query("SELECT filename FROM _migrations ORDER BY applied_at ASC");
        res.rows.forEach((r) => applied.add(r.filename));
        for (const file of files) {
            if (applied.has(file)) {
                console.log(`Already applied: ${file}`);
                continue;
            }
            const fullPath = path_1.default.join(MIGRATIONS_DIR, file);
            const sql = fs_1.default.readFileSync(fullPath, "utf-8");
            console.log(`Applying migration: ${file}`);
            await client.query("BEGIN");
            try {
                await client.query(sql);
                await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [
                    file,
                ]);
                await client.query("COMMIT");
                console.log(`Applied: ${file}`);
            }
            catch (err) {
                await client.query("ROLLBACK");
                console.error(`Failed: ${file}`, err);
                process.exit(1);
            }
        }
        console.log("Migrations complete.");
    }
    catch (e) {
        console.error(e);
        process.exit(1);
    }
    finally {
        await client.end();
    }
}
run();
