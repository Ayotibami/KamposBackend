// Quick seed: 3 verified gists for testing the cache/pill
// Run: node scripts/seed-verified-gists.js
import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

const GISTS = [
  "That moment when the projector no gree work and the lecturer says 'make una manage like that.' Sir, you are about to draw a whole graph with your bare hands. We go manage sha, but the drawing go look like NEPA map.",
];

async function main() {
  console.log("Seeding 3 verified gists for ayoti...");
  for (const text of GISTS) {
    const { rows } = await pool.query(
      "INSERT INTO gists (avitag, gist_text, gist_status) VALUES ($1, $2, 'APPROVED') RETURNING gist_id",
      ["ayoti", text],
    );
    console.log("  Created:", rows[0].gist_id);
  }
  console.log("Done — 3 verified gists seeded.");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
