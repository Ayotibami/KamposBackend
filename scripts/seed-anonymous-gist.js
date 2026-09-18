// Quick seed: one anonymous gist for testing the feed
// Run: node scripts/seed-anonymous-gist.js
import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

const TEXT =
  "Posting this anonymously because if my roommate finds out I ate the jollof rice she was saving, I'm dead. It was worth it though.";

async function main() {
  const { rows } = await pool.query(
    "INSERT INTO gists (avitag, gist_text, gist_status, is_anonymous) VALUES ($1, $2, 'APPROVED', true) RETURNING gist_id",
    ["ayoti", TEXT],
  );
  console.log("Created anonymous gist:", rows[0].gist_id);
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
