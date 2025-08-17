import fs from "fs";
import path from "path";
import { env } from "./env.config";

/**
 * Load Apple private key PEM.
 * Priority:
 * 1) env.APPLE_PRIVATE_KEY (single-line with \n escaped) -> unescape newlines
 * 2) env.APPLE_PRIVATE_KEY_PATH -> read file
 *
 * Throws if not found.
 */
export function loadApplePrivateKey(): string {
  if (env.APPLE_PRIVATE_KEY && env.APPLE_PRIVATE_KEY.trim()) {
    // allow storing the PEM in .env with literal \n characters
    return env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  }

  const p = process.env.APPLE_PRIVATE_KEY_PATH ?? "";
  if (p) {
    const resolved = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    if (!fs.existsSync(resolved)) throw new Error(`APPLE_PRIVATE_KEY_PATH not found: ${resolved}`);
    return fs.readFileSync(resolved, "utf8");
  }

  throw new Error("Apple private key not configured (APPLE_PRIVATE_KEY or APPLE_PRIVATE_KEY_PATH)");
}