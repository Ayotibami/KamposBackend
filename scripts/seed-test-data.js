// One-off dev seed script — NOT part of the app, run manually:
//   node scripts/seed-test-data.js
// Creates 10 student profiles, one gist each (realistic Naija-student
// banter/jokes/sarcasm), plus views/reactions/comments/reports scattered
// across them so there's real-looking data to test the feed against.

import "dotenv/config";
import { Pool } from "pg";
import argon2 from "argon2";

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

const CAMPUSES = [
  { tag: "unilag", name: "University of Lagos" },
  { tag: "oau", name: "Obafemi Awolowo University" },
  { tag: "uniben", name: "University of Benin" },
  { tag: "ui", name: "University of Ibadan" },
  { tag: "unn", name: "University of Nigeria, Nsukka" },
];

const MAJORS = [
  { tag: "computer_science", name: "Computer Science" },
  { tag: "economics", name: "Economics" },
  { tag: "mass_communication", name: "Mass Communication" },
  { tag: "law", name: "Law" },
  { tag: "accounting", name: "Accounting" },
  { tag: "biochemistry", name: "Biochemistry" },
  { tag: "mechanical_engineering", name: "Mechanical Engineering" },
  { tag: "english_language", name: "English Language" },
  { tag: "business_administration", name: "Business Administration" },
  { tag: "psychology", name: "Psychology" },
];

const STUDENTS = [
  { avitag: "tobi_waves", first: "Tobi", last: "Adewale", campus: "unilag", major: "computer_science", level: 300, verified: true },
  { avitag: "adaeze_vibes", first: "Ada", last: "Nwosu", campus: "unn", major: "law", level: 400, verified: false },
  { avitag: "kelvin_dbrand", first: "Kelvin", last: "Okafor", campus: "uniben", major: "mechanical_engineering", level: 200, verified: false },
  { avitag: "fatimabee", first: "Fatima", last: "Bello", campus: "ui", major: "psychology", level: 300, verified: true },
  { avitag: "chidi_no_chill", first: "Chidi", last: "Eze", campus: "oau", major: "economics", level: 400, verified: false },
  { avitag: "blessing254", first: "Blessing", last: "Uche", campus: "unilag", major: "accounting", level: 100, verified: false },
  { avitag: "emeka_thecruise", first: "Emeka", last: "Obi", campus: "unn", major: "mass_communication", level: 300, verified: true },
  { avitag: "zainabspeaks", first: "Zainab", last: "Yusuf", campus: "ui", major: "english_language", level: 200, verified: false },
  { avitag: "dami_jollof", first: "Damilola", last: "Fashola", campus: "unilag", major: "business_administration", level: 400, verified: false },
  { avitag: "ifeomavibes", first: "Ifeoma", last: "Chukwu", campus: "oau", major: "biochemistry", level: 300, verified: true },
];

const BIOS = [
  "Just here to vibe and pass my exams, one cruise at a time.",
  "Future lawyer, current stress-ball. Send jollof.",
  "Engineering student who dey more like comedian sha.",
  "Overthinker, undersleeper. Ask me about my GPA nicely.",
  "I don't do drama, I just narrate it.",
  "Accounting major, professional broke person.",
  "Campus journalist for the tea, not the assignments.",
  "Reading English, living pidgin.",
  "Building a business empire between lectures.",
  "Biochemistry by day, gist queen by night.",
];

const GIST_TEXTS = [
  "Omo see as lecturer just cancel test for 8am then post another one for 8:05am like say na relay race. This school no just love us.",
  "My roommate don enter 'no eating outside food' era since im girl start cooking for am. Bros just dey glow like network signal for MTN.",
  "Went to check my GPA and met the portal loading like say na dial-up internet from 2005. E don show finally... omo make I just faint small.",
  "POV: you borrow 500 naira for hostel and the person don turn am to 'we need to talk' every time e see you for corridor 😭",
  "Lecturer said 'this is not rocket science' then proceeded to draw something wey even NASA go need consultant for. Na so we dey learn.",
  "Cafeteria jollof today taste like they cooked it with the smoke alarm on. E get why person go choose Indomie over degree sometimes.",
  "The way this hostel wifi dey disappear anytime assignment deadline dey come na spiritual attack, I no fit lie.",
  "Course rep just sent 'meeting by 9am sharp sharp' — omo we all know that meeting go start by 10:45 with prayer point first.",
  "Bro borrowed my charger three weeks ago and now e dey greet me like say na me get debt. Charger don become dowry abi wetin.",
  "Invigilator dey waka up and down like say na catwalk while person just dey whisper answer under breath — Naija exam hall na different movie set.",
];

const COMMENT_BANK = [
  "Omo see wahala 😂😂",
  "Na lie, oga you dey exaggerate",
  "This one pain me pass wetin happen to me yesterday",
  "I laughed longer than I should have 💀",
  "Add me for the group chat make we cry together",
  "Na so them dey do us for this school",
  "Bros this na real life documentary",
  "You no dey tire to yarn true things",
  "E choke 😭",
  "Tag the lecturer make e see am",
  "This your school get better content than Netflix",
  "Story story, but you no lie sha",
];

const REACTION_TYPES = ["LIKE", "LOVE", "FIRE", "SAD", "WOW"];
const REPORT_REASONS = ["This one no chill abeg", "Dis one dey too much", "Not cool for this platform"];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}
function pick(arr, n) {
  return shuffle(arr).slice(0, n);
}

async function main() {
  const client = await pool.connect();
  try {
    console.log("Seeding reference data (campus/major)...");
    for (const c of CAMPUSES) {
      await client.query(
        `INSERT INTO campus (campus_tag, campus_name) VALUES ($1, $2) ON CONFLICT (campus_tag) DO NOTHING`,
        [c.tag, c.name]
      );
    }
    for (const m of MAJORS) {
      await client.query(
        `INSERT INTO major (major_tag, major_name) VALUES ($1, $2) ON CONFLICT (major_tag) DO NOTHING`,
        [m.tag, m.name]
      );
    }

    console.log("Hashing shared test password...");
    const passwordHash = await argon2.hash("Password123!", { type: argon2.argon2id });

    console.log("Creating accounts + student profiles...");
    const accountIds = {};
    for (const s of STUDENTS) {
      const email = `${s.avitag}@kampos.test`;
      const { rows } = await client.query(
        `INSERT INTO accounts (email, password_hash, auth_provider, is_otp_verified, account_status)
         VALUES ($1, $2, 'EMAIL', TRUE, 'ACTIVE') RETURNING account_id`,
        [email, passwordHash]
      );
      const account_id = rows[0].account_id;
      accountIds[s.avitag] = account_id;

      const bioIdx = STUDENTS.indexOf(s);
      await client.query(
        `INSERT INTO student_profiles
           (avitag, account_id, first_name, last_name, display_name, campus_tag, major_tag, level, bio, degree, is_verified, profile_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'BACHELORS', $10, 'ACTIVE')`,
        [s.avitag, account_id, s.first, s.last, `${s.first} ${s.last}`, s.campus, s.major, s.level, BIOS[bioIdx], s.verified]
      );
    }

    console.log("Creating gists...");
    const gistIds = [];
    for (let i = 0; i < STUDENTS.length; i++) {
      const s = STUDENTS[i];
      const { rows } = await client.query(
        `INSERT INTO gists (avitag, gist_text, gist_status) VALUES ($1, $2, 'APPROVED') RETURNING gist_id`,
        [s.avitag, GIST_TEXTS[i]]
      );
      gistIds.push(rows[0].gist_id);
    }

    console.log("Adding views, reactions, comments, and a few reports...");
    for (let i = 0; i < gistIds.length; i++) {
      const gist_id = gistIds[i];
      const author = STUDENTS[i].avitag;
      const others = STUDENTS.map((s) => s.avitag).filter((a) => a !== author);

      // Views: a mix of known students (repeats allowed) + anonymous views.
      const viewCount = randInt(15, 50);
      for (let v = 0; v < viewCount; v++) {
        const anon = Math.random() < 0.4;
        const viewer = anon ? null : others[randInt(0, others.length - 1)];
        await client.query(`INSERT INTO gist_views (gist_id, avitag) VALUES ($1, $2)`, [gist_id, viewer]);
      }

      // Reactions: distinct reactors (unique constraint per entity+avitag).
      const reactors = pick(others, randInt(3, others.length));
      for (const r of reactors) {
        const type = REACTION_TYPES[randInt(0, REACTION_TYPES.length - 1)];
        await client.query(
          `INSERT INTO reactions (avitag, entity_type, entity_id, type) VALUES ($1, 'GIST', $2, $3)
           ON CONFLICT (entity_type, entity_id, avitag) DO NOTHING`,
          [r, gist_id, type]
        );
      }

      // Comments: 2-4 replies from other students.
      const commenters = pick(others, randInt(2, 4));
      for (const c of commenters) {
        const text = COMMENT_BANK[randInt(0, COMMENT_BANK.length - 1)];
        await client.query(`INSERT INTO comments (gist_id, avitag, text) VALUES ($1, $2, $3)`, [gist_id, c, text]);
      }

      // Reports: only on 3 of the 10 gists, one report each — realistic sparse moderation load.
      if (i % 3 === 0) {
        const reporter = others[randInt(0, others.length - 1)];
        const reason = REPORT_REASONS[randInt(0, REPORT_REASONS.length - 1)];
        await client.query(`INSERT INTO gist_reports (gist_id, reporter_avitag, reason) VALUES ($1, $2, $3)`, [
          gist_id,
          reporter,
          reason,
        ]);
        await client.query(`UPDATE gists SET is_reported = TRUE WHERE gist_id = $1`, [gist_id]);
      }
    }

    console.log("\nDone. 10 student profiles + gists seeded, each with views/reactions/comments.");
    console.log("Shared test login password for all seeded accounts: Password123!");
    console.log("Emails: <avitag>@kampos.test, e.g. tobi_waves@kampos.test");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
