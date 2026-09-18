// Quick seed: a gist with 2 real media items owned by ibrahim_codes, for
// testing the repost/Yarn back media rendering without hunting through
// the ranked feed for an existing media gist.
// Run: node scripts/seed-ibrahim-media-gist.js
import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

async function main() {
  const { rows } = await pool.query(
    "INSERT INTO gists (avitag, gist_text, gist_status) VALUES ($1, $2, 'APPROVED') RETURNING gist_id",
    ["ibrahim_codes", "Two-photo test gist for the repost media check"],
  );
  const gistId = rows[0].gist_id;

  const urls = [
    "https://res.cloudinary.com/dbyxdhnjb/image/upload/v1789630782/kampos/gists/66202944-07b6-4b99-aacf-2b40722e808b/n63i5xv6oqla1rnr5qhe.jpg",
    "https://res.cloudinary.com/dbyxdhnjb/image/upload/v1789630782/kampos/gists/66202944-07b6-4b99-aacf-2b40722e808b/or2gvhryqzo8avw925r7.jpg",
  ];
  for (let i = 0; i < urls.length; i++) {
    await pool.query(
      `INSERT INTO gist_media (gist_id, media_type, media_url, width, height, order_index)
       VALUES ($1, 'IMAGE', $2, 960, 1280, $3)`,
      [gistId, urls[i], i],
    );
  }
  console.log("Created media gist:", gistId);
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
