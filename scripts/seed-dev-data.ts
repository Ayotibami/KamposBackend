// Dev-only seed script — populates the LOCAL Postgres (Docker) with more
// campuses, majors, student profiles, gists, comments, and reactions so
// there's actually something to browse/test against. Safe to re-run: every
// insert either ON CONFLICT DO NOTHING (campus/major/accounts by email) or
// checks for an existing avitag first, so running this twice just tops up
// rather than duplicating.
//
// Run: npm run seed  (see package.json)
import "dotenv/config";
import { Pool } from "pg";
import argon2 from "argon2";

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

// A real, working password for every seeded account — lets you actually
// log in as any of these through the real UI, not just view them.
const SEED_PASSWORD = "Password123!";

const CAMPUSES: Array<{ tag: string; name: string }> = [
  { tag: "unilag", name: "University of Lagos" },
  { tag: "ui", name: "University of Ibadan" },
  { tag: "oau", name: "Obafemi Awolowo University" },
  { tag: "unn", name: "University of Nigeria, Nsukka" },
  { tag: "unilorin", name: "University of Ilorin" },
  { tag: "uniben", name: "University of Benin" },
  { tag: "abu", name: "Ahmadu Bello University" },
  { tag: "lasu", name: "Lagos State University" },
  { tag: "uniport", name: "University of Port Harcourt" },
  { tag: "covenant", name: "Covenant University" },
  { tag: "futa", name: "Federal University of Technology, Akure" },
  { tag: "unijos", name: "University of Jos" },
  { tag: "buk", name: "Bayero University Kano" },
  { tag: "unical", name: "University of Calabar" },
  { tag: "funaab", name: "Federal University of Agriculture, Abeokuta" },
];

const MAJORS: Array<{ tag: string; name: string }> = [
  { tag: "cs", name: "Computer Science" },
  { tag: "pos", name: "Political Science" },
  { tag: "mcb", name: "Microbiology" },
  { tag: "bch", name: "Biochemistry" },
  { tag: "eee", name: "Electrical / Electronic Engineering" },
  { tag: "mec", name: "Mechanical Engineering" },
  { tag: "cve", name: "Civil Engineering" },
  { tag: "eco", name: "Economics" },
  { tag: "acc", name: "Accounting" },
  { tag: "law", name: "Law" },
  { tag: "med", name: "Medicine & Surgery" },
  { tag: "nur", name: "Nursing Science" },
  { tag: "mth", name: "Mathematics" },
  { tag: "phy", name: "Physics" },
  { tag: "chm", name: "Chemistry" },
  { tag: "eng", name: "English Language" },
  { tag: "mgt", name: "Business Management" },
  { tag: "psy", name: "Psychology" },
  { tag: "soc", name: "Sociology" },
  { tag: "arc", name: "Architecture" },
  { tag: "mass", name: "Mass Communication" },
];

// avitag, first, last — real avitags double as the login-friendly handle.
const STUDENTS: Array<{ avitag: string; first: string; last: string; bio: string }> = [
  { avitag: "chidi_codes", first: "Chidi", last: "Okafor", bio: "Building small things, breaking bigger ones. CS gang wetin dey happen." },
  { avitag: "amara_reads", first: "Amara", last: "Nwosu", bio: "Law student by day, novel addict by night. Abeg no come my DM with wahala." },
  { avitag: "tunde_fit", first: "Tunde", last: "Bakare", bio: "Gym rat, part-time genius. If you no see me for lecture, check the gym." },
  { avitag: "zainab_writes", first: "Zainab", last: "Muhammed", bio: "Mass comm finalist. I dey collect stories like say na data." },
  { avitag: "emeka_grinds", first: "Emeka", last: "Eze", bio: "Engineering wan kill me but I go still graduate with First Class abeg." },
  { avitag: "funke_vibes", first: "Funke", last: "Adebayo", bio: "Psychology student who understands everybody wahala except mine." },
  { avitag: "yusuf_builds", first: "Yusuf", last: "Ibrahim", bio: "Architecture + no sleep = my whole degree program." },
  { avitag: "ngozi_speaks", first: "Ngozi", last: "Chukwu", bio: "Political science, aspiring senator, current broke student." },
  { avitag: "kelechi_runs", first: "Kelechi", last: "Obi", bio: "Med school don age me well well. Pray for me." },
  { avitag: "hauwa_studies", first: "Hauwa", last: "Bello", bio: "Accounting major — I balance books better than I balance my life." },
  { avitag: "segun_hustles", first: "Segun", last: "Ogunleye", bio: "Economics student trying to understand why banku dey cost so much." },
  { avitag: "ada_designs", first: "Ada", last: "Nnamdi", bio: "Civil engineering, future bridge builder, current stress carrier." },
  { avitag: "bello_thinks", first: "Bello", last: "Suleiman", bio: "Philosophy of a broke chemistry student: e go better." },
  { avitag: "grace_leads", first: "Grace", last: "Effiong", bio: "Nursing student — I don see things, but I still dey smile." },
  { avitag: "dayo_creates", first: "Dayo", last: "Fashola", bio: "Physics major, professional overthinker, part-time meme lord." },
];

const GIST_TEXTS = [
  "Lecturer just cancel class 5 minutes to time and I don already trek come school 😭",
  "Anybody wey sabi where to print assignment for a good price around here abeg holler.",
  "The hostel light situation don pass ordinary. Una well done for us.",
  "First class na scam if the cafeteria food no go improve with it.",
  "Just submitted my project and I swear my hand dey shake like leaf.",
  "Why exam timetable dey always clash for the courses wey we no ready for?",
  "Somebody explain to me why 8am lecture still exist in 2026.",
  "The library WiFi work today and I no know wetin to do with my life again.",
  "Group project palava never tire us abi na wetin dey happen.",
  "See as this school don turn me to correct budgeter, I sabi manage 500 naira sotay.",
  "Congrats to everyone wey pass the GST exam, una try well well.",
  "Department dinner was actually fire, big up to the organizing committee.",
  "Anybody dey sell second-hand textbook for this semester's courses?",
  "The struggle of finding a quiet reading spot for this school na real ministry work.",
  "Just discovered a new shortcut to the faculty and I feel like a genius.",
  "Lecturer said 'I no go teach past syllabus' then proceed to teach entire syllabus in one class.",
  "Campus love stories dey too much this semester, una should slow down small.",
  "The rain wey fall this morning nearly wash the whole department comot.",
  "If you see me sleeping for library, no be laziness, na pure exhaustion.",
  "This new semester timetable no favor anybody, we dey all suffer together.",
  "Shoutout to whoever dey share free past questions, God go bless una hustle.",
  "The debate society meeting today was actually one of the best things I attended this semester.",
  "Anybody know a good barber around campus? My hair don pass level.",
  "Just realized assignment deadline na tomorrow and I don start one line.",
  "The new intake students dey too fresh, make una relax small.",
];

const COMMENT_TEXTS = [
  "Omo I feel this one well well 😂",
  "Na so o, we dey suffer together.",
  "Abeg where exactly is this happening?",
  "This one na real talk.",
  "I can relate too much to this one.",
  "Chaii, school no easy at all.",
  "Thank you for sharing this, made my day.",
  "Wait, for real? Tell me more.",
  "Same energy over here.",
  "This made me laugh so hard 😭",
  "Solidarity forever, we go survive am.",
  "Na wa o, hope things go better.",
];

const REACTION_TYPES = ["LIKE", "LOVE", "FIRE", "SAD", "LAUGH"] as const;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("Seeding campuses...");
  for (const c of CAMPUSES) {
    await pool.query(
      `INSERT INTO campus (campus_tag, campus_name) VALUES ($1, $2) ON CONFLICT (campus_tag) DO NOTHING`,
      [c.tag, c.name],
    );
  }

  console.log("Seeding majors...");
  for (const m of MAJORS) {
    await pool.query(
      `INSERT INTO major (major_tag, major_name) VALUES ($1, $2) ON CONFLICT (major_tag) DO NOTHING`,
      [m.tag, m.name],
    );
  }

  console.log("Hashing seed password...");
  const passwordHash = await argon2.hash(SEED_PASSWORD, { type: argon2.argon2id });

  console.log("Seeding student accounts + profiles...");
  const createdAvitags: string[] = [];
  for (const s of STUDENTS) {
    const existing = await pool.query(`SELECT avitag FROM student_profiles WHERE avitag = $1`, [s.avitag]);
    if (existing.rows.length > 0) {
      createdAvitags.push(s.avitag);
      continue;
    }
    const email = `${s.avitag}@kampos.dev`;
    const campus = pick(CAMPUSES).tag;
    const major = pick(MAJORS).tag;
    const level = pick([100, 200, 300, 400, 500, 600]);
    const acct = await pool.query<{ account_id: string }>(
      `INSERT INTO accounts (email, password_hash, is_otp_verified, account_status)
       VALUES ($1, $2, true, 'ACTIVE') RETURNING account_id`,
      [email, passwordHash],
    );
    await pool.query(
      `INSERT INTO student_profiles (avitag, account_id, first_name, last_name, campus_tag, major_tag, level, bio, is_verified, profile_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 'ACTIVE')`,
      [s.avitag, acct.rows[0].account_id, s.first, s.last, campus, major, level, s.bio],
    );
    createdAvitags.push(s.avitag);
  }

  console.log("Seeding gists...");
  const gistIds: string[] = [];
  for (let i = 0; i < 25; i++) {
    const avitag = pick(createdAvitags);
    const profile = await pool.query<{ campus_tag: string | null; major_tag: string | null }>(
      `SELECT campus_tag, major_tag FROM student_profiles WHERE avitag = $1`,
      [avitag],
    );
    const { campus_tag, major_tag } = profile.rows[0];
    // Spread creation times over the last 3 days so the decay-ranked feed
    // (reactions/comments/shares divided down by age) actually has
    // something to differentiate — all-identical timestamps would rank
    // purely by engagement with no age signal at all.
    const hoursAgo = randomInt(0, 72);
    const created = new Date(Date.now() - hoursAgo * 3600_000);
    const row = await pool.query<{ gist_id: string }>(
      `INSERT INTO gists (avitag, gist_text, campus_tag, major_tag, gist_status, created_at)
       VALUES ($1, $2, $3, $4, 'APPROVED', $5) RETURNING gist_id`,
      [avitag, pick(GIST_TEXTS), campus_tag, major_tag, created.toISOString()],
    );
    gistIds.push(row.rows[0].gist_id);
  }

  console.log("Seeding comments...");
  for (const gistId of gistIds) {
    const commentCount = randomInt(0, 4);
    for (let i = 0; i < commentCount; i++) {
      await pool.query(
        `INSERT INTO comments (gist_id, avitag, text) VALUES ($1, $2, $3)`,
        [gistId, pick(createdAvitags), pick(COMMENT_TEXTS)],
      );
    }
  }

  console.log("Seeding reactions...");
  for (const gistId of gistIds) {
    const reactorCount = randomInt(0, 8);
    const reactors = new Set<string>();
    for (let i = 0; i < reactorCount; i++) reactors.add(pick(createdAvitags));
    for (const avitag of reactors) {
      await pool.query(
        `INSERT INTO reactions (avitag, entity_type, entity_id, type)
         VALUES ($1, 'GIST', $2, $3)
         ON CONFLICT (entity_type, entity_id, avitag) DO NOTHING`,
        [avitag, gistId, pick(REACTION_TYPES)],
      );
    }
  }

  console.log(`Done. ${CAMPUSES.length} campuses, ${MAJORS.length} majors, ${createdAvitags.length} students, ${gistIds.length} gists.`);
  console.log(`Every seeded account's password: ${SEED_PASSWORD}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
