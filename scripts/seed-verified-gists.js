// Quick seed: verified gists for testing the cache/pill
// Run: node scripts/seed-verified-gists.js
import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

const GISTS = [
  "That moment when the projector no gree work and the lecturer says 'make una manage like that.' Sir, you are about to draw a whole graph with your bare hands. We go manage sha, but the drawing go look like NEPA map.",
  "Hostel wifi don show me pepper again. I dey try submit assignment since 11pm, na now e dey load. Portal go close for 2 minutes, God abeg.",
  "Guy borrowed my calculator for exam hall since 300 level, I'm 400 level now. Bro I no dey vex again, e don become inheritance.",
  "Cafeteria increased rice price again and reduced the portion too?? Na wa o, inflation dey hit even beans for this school.",
  "Lecturer said 'this one na easy course' — meanwhile the course outline get 14 chapters and exam na in 3 weeks. Easy for who exactly sir.",
  "Group project WhatsApp group don turn ghost town since Monday, presentation na tomorrow and only me and one other person don type anything. We go carry this cross together I guess.",
];

async function main() {
  console.log(`Seeding ${GISTS.length} verified gists for ayoti...`);
  for (const text of GISTS) {
    const { rows } = await pool.query(
      "INSERT INTO gists (avitag, gist_text, gist_status) VALUES ($1, $2, 'APPROVED') RETURNING gist_id",
      ["ayoti", text],
    );
    console.log("  Created:", rows[0].gist_id);
  }
  console.log(`Done — ${GISTS.length} verified gists seeded.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
