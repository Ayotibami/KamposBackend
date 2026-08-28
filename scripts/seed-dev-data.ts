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
  { avitag: "chioma_paints", first: "Chioma", last: "Uzo", bio: "Architecture student, part-time artist. My hostel wall don turn gallery." },
  { avitag: "ibrahim_codes", first: "Ibrahim", last: "Sani", bio: "CS + side hustle building apps. Sleep is a myth I've heard about." },
  { avitag: "blessing_sings", first: "Blessing", last: "Etim", bio: "Mass comm, choir lead, campus fellowship usher. God dey too much." },
  { avitag: "wale_debates", first: "Wale", last: "Adeyemi", bio: "Political science, debate captain. I fit argue say water no wet." },
  { avitag: "peace_studies", first: "Peace", last: "Okon", bio: "Nursing student running on garri and prayer points." },
  { avitag: "abdul_grinds", first: "Abdul", last: "Yusuf", bio: "Mechanical engineering. Workshop don teach me patience I never ask for." },
  { avitag: "titi_hustles", first: "Titi", last: "Alabi", bio: "Business management by day, thrift store owner by night. Ask me for sizes." },
  { avitag: "David_reads", first: "David", last: "Umeh", bio: "Law student, moot court addict. Case law dey my dreams now." },
  { avitag: "mercy_codes", first: "Mercy", last: "Danjuma", bio: "Software engineering minor, main character energy for group projects." },
  { avitag: "sam_kicks", first: "Sam", last: "Okoye", bio: "Sports science, department football captain. We go win inter-house this year." },
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
  "ASUU should just tell us straight if strike dey come again, we need to plan our lives.",
  "School fees portal don crash since morning, na so I go carry last for registration again.",
  "Whoever dey use the ICT centre printer for their entire final year project, abeg drop am small.",
  "Just used ChatGPT to explain a concept my lecturer couldn't explain in 3 lectures. We move.",
  "Hostel curfew wahala never tire. Security man knows my face too well at this point.",
  "Generator noise all night, exam by 8am, and my brain still dey function somehow. God dey.",
  "Whoever dey sell small chops around the faculty in the evening, you're the real MVP.",
  "Landlord for off-campus students just increase rent again, e never even reach session end.",
  "My roommate's alarm don ring since 5am, snooze after snooze, we're all suffering together.",
  "Just found out today na the deadline for course registration, thank God for last-minute miracles.",
  "The queue for the bank ATM on campus longer than the queue for exam hall this morning.",
  "Congrats to the debate society for winning inter-university again, una carry us go far.",
  "Project supervisor don travel and refuse to respond to email for two weeks now, we dey wait.",
  "Somebody's phone don ring for exam hall and the whole room turned to look at the poor soul.",
  "Small business dey boom for this campus — thrift, hair, recharge card, na who no dey hustle.",
  "The WiFi hotspot sharing agreement in our hostel needs its own constitution at this point.",
  "Just calculated my CGPA and I need to sit down somewhere quiet for a moment.",
  "Carryover course don become like an old friend I keep meeting every semester.",
  "The canteen increased prices again and the portion size somehow reduced too. Make it make sense.",
  "Final year project defense panel asked me one question and my whole life flashed before me.",
  "NYSC call-up letter anticipation hitting different as final year students. E don remain small.",
  "Whoever's playing loud music by 2am in the hostel, we need to have a serious conversation.",
  "Just borrowed a calculator for exam because mine refused to switch on. Village people at work.",
  "The department WhatsApp group has more drama than any TV series I've ever watched.",
  "Matriculation gown rental prices don increase, but we go still look fine sha.",
  "Power bank saved my life during this exam period, shoutout to whoever invented it.",
  "The okada men around campus have increased fare again, my transport budget can't keep up.",
  "Group project WhatsApp chat with 40 messages and nobody has actually started the work.",
  "Just aced a test I didn't even study for, and failed one I read for three days. School is fear.",
  "The fellowship program on campus this weekend was actually really refreshing, needed that.",
  "Invigilator confiscated somebody's phone mid-exam, the walk of shame was unmatched.",
  "Handout from three sessions ago still dey circulate and half the content don outdated.",
  "Just watched my coursemate present a project idea that low-key sounds like a real startup.",
  "The struggle to find a working printer during project submission week is a whole sport.",
  "Someone's laptop charger port don spoil during exam week, the timing couldn't be worse.",
  "Cultural day for the department was so colorful this year, big up to the planning committee.",
  "The queue at the faculty photocopy shop today reached all the way to the stairs.",
  "Just realized I've been pronouncing a course code wrong for two whole semesters.",
  "TikTok trend from a lecture hall video is now the most popular thing on campus this week.",
  "Alumni homecoming event had some real inspiring stories, made me excited for what's ahead.",
  "The hackathon this weekend humbled me small, but I learnt more in two days than a whole month.",
  "Quiz competition between departments got heated today, the rivalry is real.",
  "Whoever's ID card scanner at the gate keeps rejecting valid cards needs to fix that machine.",
  "Exam seat number wahala again, three people assigned to one seat, the coordination na wa.",
  "Just paid ajo contribution for this month and my account is crying, but future me will thank me.",
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

// Overridable via `SEED_GIST_COUNT=50 npm run seed` for a quicker/smaller run.
const GIST_COUNT = Number(process.env.SEED_GIST_COUNT) || 200;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Builds and runs a single multi-row `INSERT ... VALUES (...), (...), ...`
// per chunk, instead of one round trip per row — at 200 gists' worth of
// gists/comments/reactions that's thousands of individual queries against a
// remote pooler (Supabase, here) versus a couple dozen batched ones.
async function batchInsert(
  table: string,
  columns: string[],
  rows: unknown[][],
  opts: { returning?: string; onConflict?: string } = {},
): Promise<Record<string, unknown>[]> {
  const CHUNK_SIZE = 100;
  const returned: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const values: unknown[] = [];
    const placeholders = chunk.map((row, ri) => {
      const base = ri * columns.length;
      values.push(...row);
      return `(${columns.map((_, ci) => `$${base + ci + 1}`).join(", ")})`;
    });
    const sql = [
      `INSERT INTO ${table} (${columns.join(", ")})`,
      `VALUES ${placeholders.join(", ")}`,
      opts.onConflict ?? "",
      opts.returning ? `RETURNING ${opts.returning}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const res = await pool.query(sql, values);
    if (opts.returning) returned.push(...res.rows);
  }
  return returned;
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

  console.log("Loading author campus/major (one query instead of one per gist)...");
  const profileRows = await pool.query<{ avitag: string; campus_tag: string | null; major_tag: string | null }>(
    `SELECT avitag, campus_tag, major_tag FROM student_profiles WHERE avitag = ANY($1)`,
    [createdAvitags],
  );
  const profileByAvitag = new Map(profileRows.rows.map((r) => [r.avitag, r]));

  console.log(`Seeding ${GIST_COUNT} gists...`);
  const gistRows = Array.from({ length: GIST_COUNT }, () => {
    const avitag = pick(createdAvitags);
    const { campus_tag, major_tag } = profileByAvitag.get(avitag) ?? { campus_tag: null, major_tag: null };
    // Spread creation times over the last 2 weeks (not just a few days) so
    // 200 gists reads like an established feed with real history instead of
    // a suspicious burst of posts that all landed in the same afternoon.
    // Also gives the decay-ranked feed (reactions/comments/shares divided
    // down by age) an actual age signal to differentiate on.
    const hoursAgo = randomInt(0, 24 * 14);
    const created = new Date(Date.now() - hoursAgo * 3600_000);
    return [avitag, pick(GIST_TEXTS), campus_tag, major_tag, "APPROVED", created.toISOString()];
  });
  const insertedGists = await batchInsert(
    "gists",
    ["avitag", "gist_text", "campus_tag", "major_tag", "gist_status", "created_at"],
    gistRows,
    { returning: "gist_id" },
  );
  const gistIds = insertedGists.map((r) => r.gist_id as string);

  console.log("Seeding comments...");
  const commentRows: unknown[][] = [];
  for (const gistId of gistIds) {
    const commentCount = randomInt(0, 4);
    for (let i = 0; i < commentCount; i++) {
      commentRows.push([gistId, pick(createdAvitags), pick(COMMENT_TEXTS)]);
    }
  }
  await batchInsert("comments", ["gist_id", "avitag", "text"], commentRows);

  console.log("Seeding reactions...");
  const reactionRows: unknown[][] = [];
  for (const gistId of gistIds) {
    const reactorCount = randomInt(0, 8);
    const reactors = new Set<string>();
    for (let i = 0; i < reactorCount; i++) reactors.add(pick(createdAvitags));
    for (const avitag of reactors) {
      reactionRows.push([avitag, "GIST", gistId, pick(REACTION_TYPES)]);
    }
  }
  await batchInsert("reactions", ["avitag", "entity_type", "entity_id", "type"], reactionRows, {
    onConflict: "ON CONFLICT (entity_type, entity_id, avitag) DO NOTHING",
  });

  console.log(`Done. ${CAMPUSES.length} campuses, ${MAJORS.length} majors, ${createdAvitags.length} students, ${gistIds.length} gists, ${commentRows.length} comments, ${reactionRows.length} reactions.`);
  console.log(`Every seeded account's password: ${SEED_PASSWORD}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
