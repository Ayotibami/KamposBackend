// Dev-only seed script — drops one fresh notification of EVERY type into
// `baddest`'s inbox (all six categories, including a DIGEST with real,
// individually-clickable bundled items) so the notifications UI can be
// tested repeatedly without waiting on real triggers or cron windows.
// Writes straight to `notifications`, bypassing the trigger/cap/mute/
// dedup logic in notification.service.ts entirely — this is for UI
// testing, not for exercising that logic (use the real triggers for that).
// Safe to re-run: every run just adds a fresh batch, nothing is deduped.
//
// Run: npm run seed:notifications
import "dotenv/config";
import { Pool } from "pg";
import * as lines from "../src/modules/notification/kappyLines";

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

const RECIPIENT = "baddest";
// Whoever this is seeded against needs a real "actor" in the same campus
// close circle so the digest's bundled items point at real, openable
// content — oluwatechie (Victor) has been the stand-in actor for this all
// session, same campus (FUL) as baddest.
const ACTOR_AVITAG = "oluwatechie";
const ACTOR_NAME = "Victor";

interface Targets {
  recipientGistId: string | null;
  actorGistId: string | null;
  actorSpotId: string | null;
  hotPostId: string | null;
  actorImageUrl: string | null;
}

async function findTargets(): Promise<Targets> {
  const [recipientGist, actorGist, actorSpot, hotPost, actorProfile] = await Promise.all([
    pool.query<{ gist_id: string }>(`SELECT gist_id FROM gists WHERE avitag = $1 ORDER BY created_at DESC LIMIT 1`, [RECIPIENT]),
    pool.query<{ gist_id: string }>(`SELECT gist_id FROM gists WHERE avitag = $1 ORDER BY created_at DESC LIMIT 1`, [ACTOR_AVITAG]),
    pool.query<{ spot_id: string }>(`SELECT spot_id FROM spots WHERE avitag = $1 ORDER BY created_at DESC LIMIT 1`, [ACTOR_AVITAG]),
    pool.query<{ hot_post_id: string }>(`SELECT hot_post_id FROM hot_posts ORDER BY created_at DESC LIMIT 1`),
    pool.query<{ image_url: string | null }>(`SELECT image_url FROM student_profiles WHERE avitag = $1`, [ACTOR_AVITAG]),
  ]);
  return {
    recipientGistId: recipientGist.rows[0]?.gist_id ?? null,
    actorGistId: actorGist.rows[0]?.gist_id ?? null,
    actorSpotId: actorSpot.rows[0]?.spot_id ?? null,
    hotPostId: hotPost.rows[0]?.hot_post_id ?? null,
    actorImageUrl: actorProfile.rows[0]?.image_url ?? null,
  };
}

async function insertNotification(n: {
  category: string;
  kappy_line: string;
  image_kind: "KAPPY" | "PROFILE_PICTURE";
  image_url?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  await pool.query(
    `INSERT INTO notifications (recipient_avitag, category, kappy_line, image_kind, image_url, target_type, target_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [RECIPIENT, n.category, n.kappy_line, n.image_kind, n.image_url ?? null, n.target_type ?? null, n.target_id ?? null, n.payload ?? null]
  );
}

async function main() {
  const t = await findTargets();

  if (!t.recipientGistId) {
    console.warn(`Warning: ${RECIPIENT} has no gists — COMMENT/REPOST will seed without a real target_id.`);
  }
  if (!t.actorGistId || !t.actorSpotId) {
    console.warn(`Warning: ${ACTOR_AVITAG} is missing a gist or spot — digest bundle will fall back to ${RECIPIENT}'s own gist for those items.`);
  }

  const fallbackGist = t.recipientGistId ?? "00000000-0000-0000-0000-000000000000";
  const actorImageKind = t.actorImageUrl ? "PROFILE_PICTURE" : "KAPPY";

  await Promise.all([
    insertNotification({
      category: "COMMENT",
      kappy_line: lines.commentLine(ACTOR_NAME, "this one too funny abeg"),
      image_kind: actorImageKind,
      image_url: t.actorImageUrl,
      target_type: "GIST",
      target_id: fallbackGist,
    }),
    insertNotification({
      category: "REPOST",
      kappy_line: lines.repostLine(ACTOR_NAME),
      image_kind: actorImageKind,
      image_url: t.actorImageUrl,
      target_type: "GIST",
      target_id: fallbackGist,
    }),
    insertNotification({
      category: "HOT_EXPIRING",
      kappy_line: lines.hotExpiringLine(ACTOR_NAME),
      image_kind: "KAPPY",
      target_type: "HOT_POST",
      target_id: t.hotPostId ?? "00000000-0000-0000-0000-000000000000",
    }),
    insertNotification({
      category: "DIGEST",
      kappy_line: [
        lines.digestIntroLine(4),
        [
          lines.milestoneItemLine(25),
          lines.trendingItemLine(ACTOR_NAME, true),
          lines.spotItemLine(ACTOR_NAME),
          lines.coursemateItemLine(ACTOR_NAME),
        ].join("; "),
      ].join(" — "),
      image_kind: "KAPPY",
      target_type: null,
      target_id: null,
      payload: {
        items: [
          { trigger_type: "REACTION_MILESTONE", target_type: "GIST", target_id: fallbackGist, actor_avitag: null },
          { trigger_type: "TRENDING_GIST", target_type: "GIST", target_id: t.actorGistId ?? fallbackGist, actor_avitag: ACTOR_AVITAG },
          { trigger_type: "SPOT_LIKES", target_type: "SPOT", target_id: t.actorSpotId ?? fallbackGist, actor_avitag: ACTOR_AVITAG },
          { trigger_type: "COURSEMATE_GIST", target_type: "GIST", target_id: t.actorGistId ?? fallbackGist, actor_avitag: ACTOR_AVITAG },
        ],
      },
    }),
    insertNotification({
      category: "INACTIVITY_NUDGE",
      kappy_line: lines.inactivityLine("wicked"),
      image_kind: "KAPPY",
    }),
    insertNotification({
      category: "ACTIVATION_NUDGE",
      kappy_line: lines.activationLine("wicked"),
      image_kind: "KAPPY",
    }),
  ]);

  console.log(`Seeded 6 fresh notifications (one per category) for ${RECIPIENT}.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
