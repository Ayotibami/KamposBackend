// One-off: seed a single SUBMITTED gist, then approve it through the real
// moderation endpoint (not a raw DB update) — approveGist() is what
// actually fires the WSGateway.broadcast('feed.global', { type:
// 'GIST_APPROVED', ... }) the frontend's NewGistsPill listens for, so this
// is the only way to genuinely trigger the pill for a live browser tab
// rather than just planting an already-approved row.
//
// Run: node scripts/trigger-new-gist-pill.mjs
import "dotenv/config";
import { Pool } from "pg";
import jwt from "jsonwebtoken";

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });
const API_BASE = `http://localhost:${process.env.PORT || 8888}`;

const TEXT =
  "Testing the new-gists pill — if you can see this pop up without refreshing, e don work!";

async function main() {
  const { rows } = await pool.query(
    "INSERT INTO gists (avitag, gist_text) VALUES ($1, $2) RETURNING gist_id",
    ["ayoti", TEXT],
  );
  const gistId = rows[0].gist_id;
  console.log("Seeded SUBMITTED gist:", gistId);

  // `king` role bypasses both isAuth's revocation check (no jti to look up)
  // and isIdiot's role check — the same bypass middleware/auth.ts and
  // middleware/idiot.ts already carve out, just minted locally for this
  // one-off script rather than a real admin session.
  const token = jwt.sign(
    { account_id: "script-trigger", role: "king", who: "king" },
    process.env.JWT_SECRET,
    { expiresIn: "5m" },
  );

  const res = await fetch(`${API_BASE}/api/v1/idiot/moderation/gists/${gistId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("Approve call failed:", res.status, body);
    process.exit(1);
  }
  console.log("Approved — feed.global GIST_APPROVED broadcast sent.", body?.data?.gist_id ?? "");
  await pool.end();
}

main().catch((err) => {
  console.error("Trigger failed:", err);
  process.exit(1);
});
