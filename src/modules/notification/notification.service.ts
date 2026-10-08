import { pool } from '../../config/db';
import * as repo from './notification.repo';
import type { NotificationCategory, TargetType, TriggerType } from './notification.repo';
import { WSGateway } from '../../ws/gateway';
import * as lines from './kappyLines';
import logger from '../../utils/logger';

const INSTANT_DAILY_CAP = 12;
const DIGEST_DAILY_CAP = 8;
// 12am-5am — no pinging during this window. Mostly matters once real push
// notifications exist (nothing is actually buzzing anyone's phone yet on
// an in-app-only inbox), but the rule is enforced now so it's already
// correct the moment push gets added later, not a thing to remember to
// bolt on then.
const QUIET_HOUR_START = 0;
const QUIET_HOUR_END = 5;

function inQuietHours(d = new Date()): boolean {
  const h = d.getHours();
  return h >= QUIET_HOUR_START && h < QUIET_HOUR_END;
}

interface ProfileSummary {
  avitag: string;
  name: string;
  image_url: string | null;
  campus_tag: string | null;
  major_tag: string | null;
  level: number | null;
}

/** Same "COALESCE across every profile table" pattern every other module's
 * AUTHOR_JOIN already uses — kept as its own small copy here (not a shared
 * import) for the same reason hot.repo.ts's own copy gives: the alias is
 * baked into the SQL as a literal string, not parameterized. */
async function getProfileSummary(avitag: string): Promise<ProfileSummary | null> {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(sp.first_name, kp.display_name, kmp.display_name, scp.display_name, idp.display_name) AS name,
       COALESCE(sp.image_url, kp.image_url, kmp.image_url, scp.image_url, idp.image_url) AS image_url,
       sp.campus_tag, sp.major_tag, sp.level
     FROM (SELECT $1::text AS avitag) seed
     LEFT JOIN student_profiles sp ON sp.avitag = seed.avitag
     LEFT JOIN kreator_profiles kp ON kp.avitag = seed.avitag
     LEFT JOIN kompany_profiles kmp ON kmp.avitag = seed.avitag
     LEFT JOIN school_profiles scp ON scp.avitag = seed.avitag
     LEFT JOIN idiot_profiles idp ON idp.avitag = seed.avitag`,
    [avitag]
  );
  const r = rows[0];
  if (!r || !r.name) return null;
  return { avitag, name: r.name, image_url: r.image_url ?? null, campus_tag: r.campus_tag ?? null, major_tag: r.major_tag ?? null, level: r.level ?? null };
}

/** Everyone in `avitag`'s own close circle — same campus+major+level,
 * then campus+major, then campus alone — the exact tiering Hot's own
 * feed ranking already uses. Used both for COURSEMATE_GIST's audience
 * and for TRENDING_GIST's "same campus" framing. Excludes `avitag`
 * itself. Student-only by nature (campus_tag is null for every other
 * profile type, so nothing else ever matches). */
/** Whether a gist's poster should stay hidden in notification copy, and
 * the gist's own stored campus_tag for the trending/Amebo campus check —
 * fetched together since both come off the same row and both gate how a
 * digest item names/frames it. */
async function getGistAnonymityAndCampus(gistId: string): Promise<{ anonymous: boolean; campus_tag: string | null }> {
  const { rows } = await pool.query<{ is_anonymous: boolean; campus_tag: string | null }>(
    `SELECT is_anonymous, campus_tag FROM gists WHERE gist_id = $1`,
    [gistId]
  );
  return { anonymous: rows[0]?.is_anonymous ?? false, campus_tag: rows[0]?.campus_tag ?? null };
}

interface ResolvedMedia {
  image_kind: repo.ImageKind;
  image_url: string | null;
}

const NO_MEDIA: ResolvedMedia = { image_kind: 'KAPPY', image_url: null };

/** A gist's first attached media (if any) — used wherever the content
 * ITSELF is the point of a notification (a milestone, trending, a
 * coursemate's new post), never the poster's own face. A video's
 * thumbnail stands in for the clip itself, same as everywhere else in
 * the app that previews video without autoplaying it. */
async function getGistMedia(gistId: string): Promise<ResolvedMedia> {
  const { rows } = await pool.query<{ media_type: string; media_url: string; thumbnail_url: string | null }>(
    `SELECT media_type, media_url, thumbnail_url FROM gist_media WHERE gist_id = $1 ORDER BY order_index ASC LIMIT 1`,
    [gistId]
  );
  const r = rows[0];
  if (!r) return NO_MEDIA;
  // A video with no thumbnail_url (possible from the legacy upload path —
  // the direct-upload finalize path always derives one, but this one
  // doesn't guarantee it) has nothing displayable as an <img> — its raw
  // media_url is a video file, which silently renders as a broken image.
  // Falls through to no media at all rather than that.
  if (r.media_type === 'VIDEO') return r.thumbnail_url ? { image_kind: 'MEDIA', image_url: r.thumbnail_url } : NO_MEDIA;
  return { image_kind: 'MEDIA', image_url: r.media_url };
}

/** A Spot's own thumbnail — Spot is always video, so unlike gist media
 * there's no PHOTO branch; no thumbnail_url means nothing displayable at
 * all (the raw media_url is a video file, not an image). */
async function getSpotMedia(spotId: string): Promise<ResolvedMedia> {
  const { rows } = await pool.query<{ media_url: string | null; thumbnail_url: string | null }>(
    `SELECT media_url, thumbnail_url FROM spots WHERE spot_id = $1`,
    [spotId]
  );
  const r = rows[0];
  if (!r?.media_url || !r.thumbnail_url) return NO_MEDIA;
  return { image_kind: 'MEDIA', image_url: r.thumbnail_url };
}

/** A Hot post's own media — Hot posts carry media_url/thumbnail_url
 * directly (they're not a wrapper around a gist/Spot), so this needs no
 * join. A TEXT-kind Hot post has no media at all, same as a gist with no
 * attachment — falls back to Kappy's own face rather than nothing. A
 * VIDEO with no thumbnail_url falls back the same way, for the same
 * reason getGistMedia/getSpotMedia do (its media_url is a video file,
 * not displayable as an <img>). */
async function getHotPostMedia(hotPostId: string): Promise<ResolvedMedia> {
  const { rows } = await pool.query<{ media_kind: string; media_url: string | null; thumbnail_url: string | null }>(
    `SELECT media_kind, media_url, thumbnail_url FROM hot_posts WHERE hot_post_id = $1`,
    [hotPostId]
  );
  const r = rows[0];
  if (!r || r.media_kind === 'TEXT' || !r.media_url) return NO_MEDIA;
  if (r.media_kind === 'VIDEO') return r.thumbnail_url ? { image_kind: 'MEDIA', image_url: r.thumbnail_url } : NO_MEDIA;
  return { image_kind: 'MEDIA', image_url: r.media_url };
}

/** A person's own profile picture, standing alone (not wrapped in
 * ResolvedMedia/image_kind) — kept separate from the content-media
 * resolvers above so a notification can carry BOTH a real actor's photo
 * AND the content's own media at once, rather than the two competing for
 * one image slot. Null when that person has no picture set. */
async function getActorPhotoUrl(avitag: string): Promise<string | null> {
  const actor = await getProfileSummary(avitag);
  return actor?.image_url ?? null;
}

async function findCloseCircle(avitag: string): Promise<string[]> {
  // "Coursemate/level-mate/CAMPUS-mate" per the locked spec — same campus
  // ALONE already qualifies, same major/level just make it a CLOSER match
  // (not currently used to rank/prioritize within the circle, only to
  // decide membership). Requiring an exact major match here was a real
  // bug: it silently excluded the broadest, spec-intended "campus-mate"
  // tier, leaving anyone whose major nobody else shares with NO circle at
  // all, which the product spec explicitly didn't want.
  const { rows } = await pool.query<{ avitag: string }>(
    `SELECT sp2.avitag FROM student_profiles sp1
     JOIN student_profiles sp2 ON sp2.avitag <> sp1.avitag AND sp2.campus_tag = sp1.campus_tag
     WHERE sp1.avitag = $1 AND sp1.campus_tag IS NOT NULL`,
    [avitag]
  );
  return rows.map((r) => r.avitag);
}

function pushLive(avitag: string, notification: repo.NotificationRow) {
  try {
    WSGateway.sendToUser(avitag, 'notification:new', { notification });
  } catch {
    /* realtime push is a nicety, the DB row is already the source of truth */
  }
}

async function withinCap(avitag: string, mode: 'instant' | 'digest'): Promise<boolean> {
  const counts = await repo.countTodayByCategory(avitag);
  return mode === 'instant' ? counts.instant < INSTANT_DAILY_CAP : counts.digest < DIGEST_DAILY_CAP;
}

async function isMuted(avitag: string, category: NotificationCategory): Promise<boolean> {
  const muted = await repo.getPreferences(avitag);
  return muted.includes(category);
}

// ---------------------------------------------------------------------------
// INSTANT triggers
// ---------------------------------------------------------------------------

export async function notifyComment(params: { gistAuthorAvitag: string; commenterAvitag: string; gistId: string; commentText: string }): Promise<void> {
  if (params.gistAuthorAvitag === params.commenterAvitag) return;
  await fireInstant({
    recipient: params.gistAuthorAvitag,
    actor: params.commenterAvitag,
    triggerType: 'COMMENT',
    category: 'COMMENT',
    targetType: 'GIST',
    targetId: params.gistId,
    buildLine: async () => {
      const actor = await getProfileSummary(params.commenterAvitag);
      // The COMMENT's own text, not the gist's — a line like `commented:
      // "{snippet}"` has to quote what they actually said, not what the
      // original gist said, or it reads as if the commenter wrote the
      // gist's own words.
      return lines.commentLine(actor?.name ?? 'Somebody', params.commentText.slice(0, 60));
    },
    // Both at once when both are real: the commenter's own face (who),
    // plus the gist's own media (what it was about), deterministically —
    // never a coin flip.
    resolveContent: () => getGistMedia(params.gistId),
    resolveActorPhoto: () => getActorPhotoUrl(params.commenterAvitag),
  });
}

export async function notifyRepost(params: { originalAuthorAvitag: string; reposterAvitag: string; gistId: string; originalGistId: string }): Promise<void> {
  if (params.originalAuthorAvitag === params.reposterAvitag) return;
  await fireInstant({
    recipient: params.originalAuthorAvitag,
    actor: params.reposterAvitag,
    triggerType: 'REPOST',
    category: 'REPOST',
    targetType: 'GIST',
    // Navigates to the REPOST (it embeds/quotes the original, so the
    // original is still visible from there) — unrelated to which gist
    // the preview media below comes from.
    targetId: params.gistId,
    buildLine: async () => {
      const actor = await getProfileSummary(params.reposterAvitag);
      return lines.repostLine(actor?.name ?? 'Somebody');
    },
    // Both at once: the reposter's own face, plus a preview picture — the
    // repost gist itself almost never has its own attached media (a
    // repost is normally just quote text), so this tries that first and
    // falls back to the ORIGINAL gist's media, which is the actual
    // content being amplified and the far more useful preview.
    resolveContent: async () => {
      const own = await getGistMedia(params.gistId);
      return own.image_kind === 'MEDIA' ? own : getGistMedia(params.originalGistId);
    },
    resolveActorPhoto: () => getActorPhotoUrl(params.reposterAvitag),
  });
}

async function fireInstant(params: {
  recipient: string;
  actor: string | null;
  triggerType: TriggerType;
  category: NotificationCategory;
  targetType: TargetType;
  targetId: string;
  buildLine: () => Promise<string>;
  // The content's own media (a gist/Spot/Hot post's picture or video) —
  // independent of who the actor is, so it can show alongside their face
  // rather than instead of it.
  resolveContent: () => Promise<ResolvedMedia>;
  // The actor's own photo, same independence — null when there's no
  // single actor or they have no picture set.
  resolveActorPhoto: () => Promise<string | null>;
}): Promise<void> {
  try {
    if (await isMuted(params.recipient, params.category)) return;
    if (inQuietHours()) return;
    if (!(await withinCap(params.recipient, 'instant'))) return;

    await repo.insertEvent({
      recipient_avitag: params.recipient,
      actor_avitag: params.actor,
      trigger_type: params.triggerType,
      target_type: params.targetType,
      target_id: params.targetId,
      delivery_mode: 'INSTANT',
    });

    const kappyLine = await params.buildLine();
    const { image_kind, image_url } = await params.resolveContent();
    const actorImageUrl = await params.resolveActorPhoto();

    const notification = await repo.insertNotification({
      recipient_avitag: params.recipient,
      category: params.category,
      kappy_line: kappyLine,
      image_kind,
      image_url,
      actor_avitag: params.actor,
      actor_image_url: actorImageUrl,
      target_type: params.targetType,
      target_id: params.targetId,
    });
    pushLive(params.recipient, notification);
  } catch (err) {
    logger.error({ err, params }, 'notification.service: fireInstant failed');
  }
}

// ---------------------------------------------------------------------------
// DIGEST-eligible triggers — these only ever write a pending event; the
// digest batcher (runDigestBatch, below) is what turns them into something
// the user actually sees.
// ---------------------------------------------------------------------------

export async function queueCoursemateGist(params: { posterAvitag: string; gistId: string }): Promise<void> {
  const circle = await findCloseCircle(params.posterAvitag);
  for (const recipient of circle) {
    if (await isMuted(recipient, 'DIGEST')) continue;
    await repo.insertEvent({
      recipient_avitag: recipient,
      actor_avitag: params.posterAvitag,
      trigger_type: 'COURSEMATE_GIST',
      target_type: 'GIST',
      target_id: params.gistId,
      delivery_mode: 'DIGEST',
    });
  }
}

const REACTION_MILESTONES = [5, 25, 100] as const;
const TRENDING_THRESHOLD = 20;
const SPOT_LIKES_THRESHOLD = 20;
// A second, much higher bar that blows past "same campus" entirely — once a
// gist/spot is THIS big, it's reached every other campus too, not just the
// poster's own. Framing stays "trending"/"Amebo" (decided per-recipient at
// render time, same as the 20-threshold tier) — this isn't a new category,
// just a wider audience for the same one.
const PLATFORM_TRENDING_THRESHOLD = 500;
const PLATFORM_SPOT_LIKES_THRESHOLD = 500;

/** Every active student NOT already in `exclude` — used for the
 * platform-wide trending/viral tier so campus-mates who already got the
 * same-campus trending notification don't get queued a second time. */
async function allActiveStudentsExcept(exclude: string[]): Promise<string[]> {
  const { rows } = await pool.query<{ avitag: string }>(
    `SELECT sp.avitag FROM student_profiles sp
     JOIN accounts a ON a.account_id = sp.account_id
     WHERE sp.profile_status = 'ACTIVE' AND a.account_status = 'ACTIVE'
       AND sp.avitag <> ALL($1::text[])`,
    [exclude]
  );
  return rows.map((r) => r.avitag);
}

/** Called after any reaction/comment lands on a gist — checks the gist's
 * own reaction count against the viewer's personal milestones (5/25/100,
 * notifies the gist's OWN author) and, independently, against the
 * platform-wide trending threshold (20, notifies the gist's close circle
 * — framed as "trending" for same-campus, "Amebo" for a different one).
 * Each crossing fires exactly once per gist, tracked via
 * notification_milestones. */
export async function checkGistMilestones(params: { gistId: string; gistAuthorAvitag: string; reactionsCount: number; commentsCount: number }): Promise<void> {
  // pg returns COUNT()-derived columns (what v_gist_counts' reactions_count/
  // comments_count both are) as STRINGS, not numbers, regardless of what
  // the TypeScript types above claim — confirmed live: without this, "9" +
  // "4" string-concatenates to "94", and "94" < 20 coerces back to a
  // number (94) for the comparison, silently passing a threshold check
  // that should have failed. Every count used below is explicitly
  // Number()'d at the boundary rather than trusted as already numeric.
  const reactionsCount = Number(params.reactionsCount);
  const commentsCount = Number(params.commentsCount);
  for (const m of REACTION_MILESTONES) {
    if (reactionsCount < m) continue;
    const key = `reactions_${m}`;
    if (await repo.milestoneAlreadyNotified('GIST', params.gistId, key)) continue;
    await repo.recordMilestone('GIST', params.gistId, key);
    if (await isMuted(params.gistAuthorAvitag, 'DIGEST')) continue;
    await repo.insertEvent({
      recipient_avitag: params.gistAuthorAvitag,
      actor_avitag: null,
      trigger_type: 'REACTION_MILESTONE',
      target_type: 'GIST',
      target_id: params.gistId,
      delivery_mode: 'DIGEST',
      data: { count: m },
    });
  }

  const engagementTotal = reactionsCount + commentsCount;
  if (engagementTotal < TRENDING_THRESHOLD) return;

  const author = await getProfileSummary(params.gistAuthorAvitag);
  if (!author) return;
  // "Elsewhere" per the product spec means everyone, not just the
  // author's own circle — a trending gist/Amebo is meant to reach people
  // who DON'T already know the poster. The 20-threshold tier below is
  // scoped to the author's own campus; a second, much higher 500
  // threshold (further down) widens that to every other campus too. Both
  // tiers are checked independently — each has its own milestone-already-
  // fired guard, so the 20-tier having already fired must NOT prevent the
  // 500-tier from firing later on the same gist (an earlier version of
  // this function had both tiers share one early `return`, which meant
  // the 500-tier could never fire at all once the 20-tier already had —
  // caught via a live test that pushed the same gist from 20 to 500
  // reactions and saw zero new events queued the second time).
  const recipients = await findCloseCircle(params.gistAuthorAvitag);
  const trigger: TriggerType = 'TRENDING_GIST';

  if (!(await repo.milestoneAlreadyNotified('GIST', params.gistId, 'trending'))) {
    await repo.recordMilestone('GIST', params.gistId, 'trending');
    // findCloseCircle already returns every same-campus student (see its
    // own doc comment — campus ALONE is the qualifying bar). The gist/
    // Amebo wording split isn't decided here at all — it's a per-
    // RECIPIENT framing choice made at render time in runDigestBatch
    // (same campus as the recipient reads as "trending gist," a
    // different one reads as "Amebo"), since the same event can read as
    // either depending on who's receiving it.
    for (const recipient of recipients) {
      if (await isMuted(recipient, 'DIGEST')) continue;
      await repo.insertEvent({
        recipient_avitag: recipient,
        actor_avitag: params.gistAuthorAvitag,
        trigger_type: trigger,
        target_type: 'GIST',
        target_id: params.gistId,
        delivery_mode: 'DIGEST',
      });
    }
  }

  // Platform-wide tier: once it's THIS big, every other campus hears about
  // it too, not just the author's own. Separate milestone key so it fires
  // independently of the 20-threshold same-campus tier above. Recipients
  // exclude the author and the same-campus circle — they already got (or
  // will get, from the block above) a trending event, no need to queue
  // them twice.
  if (engagementTotal >= PLATFORM_TRENDING_THRESHOLD && !(await repo.milestoneAlreadyNotified('GIST', params.gistId, 'trending_platform'))) {
    await repo.recordMilestone('GIST', params.gistId, 'trending_platform');
    const platformRecipients = await allActiveStudentsExcept([params.gistAuthorAvitag, ...recipients]);
    for (const recipient of platformRecipients) {
      if (await isMuted(recipient, 'DIGEST')) continue;
      await repo.insertEvent({
        recipient_avitag: recipient,
        actor_avitag: params.gistAuthorAvitag,
        trigger_type: trigger,
        target_type: 'GIST',
        target_id: params.gistId,
        delivery_mode: 'DIGEST',
      });
    }
  }
}

export async function checkSpotMilestone(params: { spotId: string; posterAvitag: string; likesCount: number }): Promise<void> {
  // Same defensive Number() coercion as checkGistMilestones above — a
  // single `<` comparison against a number literal happens to coerce a
  // string correctly on its own, but there's no reason to rely on that
  // accident once the adjacent function needed fixing for the same root
  // cause (pg returning COUNT()-derived columns as strings).
  const likesCount = Number(params.likesCount);
  if (likesCount < SPOT_LIKES_THRESHOLD) return;
  const circle = await findCloseCircle(params.posterAvitag);

  // Both tiers are checked independently, same fix as checkGistMilestones
  // above — the 20-tier's milestone having already fired must not skip
  // the 500-tier check too (an earlier version shared one early `return`,
  // so the platform tier could never fire once the circle tier already
  // had).
  if (!(await repo.milestoneAlreadyNotified('SPOT', params.spotId, 'likes'))) {
    await repo.recordMilestone('SPOT', params.spotId, 'likes');
    for (const recipient of circle) {
      if (await isMuted(recipient, 'DIGEST')) continue;
      await repo.insertEvent({
        recipient_avitag: recipient,
        actor_avitag: params.posterAvitag,
        trigger_type: 'SPOT_LIKES',
        target_type: 'SPOT',
        target_id: params.spotId,
        delivery_mode: 'DIGEST',
      });
    }
  }

  // Same platform-wide tier as the gist side — once a Spot is THIS big, it
  // reaches every other campus too, not just the poster's own circle.
  if (likesCount < PLATFORM_SPOT_LIKES_THRESHOLD) return;
  if (await repo.milestoneAlreadyNotified('SPOT', params.spotId, 'likes_platform')) return;
  await repo.recordMilestone('SPOT', params.spotId, 'likes_platform');
  const platformRecipients = await allActiveStudentsExcept([params.posterAvitag, ...circle]);
  for (const recipient of platformRecipients) {
    if (await isMuted(recipient, 'DIGEST')) continue;
    await repo.insertEvent({
      recipient_avitag: recipient,
      actor_avitag: params.posterAvitag,
      trigger_type: 'SPOT_LIKES',
      target_type: 'SPOT',
      target_id: params.spotId,
      delivery_mode: 'DIGEST',
    });
  }
}

// ---------------------------------------------------------------------------
// The 3-hour digest batcher — see index.ts for the cron registration.
// ---------------------------------------------------------------------------

export async function runDigestBatch(): Promise<void> {
  const pending = await repo.findPendingDigestEvents();
  if (pending.length === 0) return;

  const byRecipient = new Map<string, typeof pending>();
  for (const ev of pending) {
    const list = byRecipient.get(ev.recipient_avitag) ?? [];
    list.push(ev);
    byRecipient.set(ev.recipient_avitag, list);
  }

  for (const [recipient, events] of byRecipient) {
    try {
      await processDigestForRecipient(recipient, events);
    } catch (err) {
      // One recipient's bad data (a malformed row, a transient DB hiccup)
      // must never block everyone else in this batch — without this, an
      // unhandled throw here kills the whole loop mid-iteration, and
      // since markEventsProcessed never runs for this recipient, their
      // same events are still pending next tick, throw again, and jam
      // the same point in the Map forever until someone notices.
      logger.error({ err, recipient }, 'notification.service: runDigestBatch failed for one recipient, continuing');
    }
  }
}

async function processDigestForRecipient(recipient: string, events: repo.NotificationEventRow[]): Promise<void> {
  if (!(await withinCap(recipient, 'digest'))) return;

  const itemLines: string[] = [];
    // Per-item content media AND actor photo, tracked independently so an
    // item can carry both at once (a coursemate's gist genuinely has
    // both a poster and a picture). Anonymity only ever gates the ACTOR
    // side (avitag + photo) — the content's own media shows regardless,
    // same as the gist's own feed card already does for an anonymous post.
    const itemMedia = new Map<string, ResolvedMedia>();
    const itemActorAvitag = new Map<string, string | null>();
    const itemActorPhoto = new Map<string, string | null>();
    for (const ev of events) {
      if (ev.trigger_type === 'COURSEMATE_GIST' && ev.actor_avitag) {
        // Anonymity is about the GIST, never about "someone posted" being
        // worth knowing — the fact that a coursemate posted still surfaces,
        // the WHO just doesn't, same as the gist's own feed already hides it.
        const { anonymous } = await getGistAnonymityAndCampus(ev.target_id);
        const actor = anonymous ? null : await getProfileSummary(ev.actor_avitag);
        itemLines.push(lines.coursemateItemLine(actor?.name ?? 'Somebody'));
        itemMedia.set(ev.event_id, await getGistMedia(ev.target_id));
        itemActorAvitag.set(ev.event_id, anonymous ? null : ev.actor_avitag);
        itemActorPhoto.set(ev.event_id, anonymous ? null : await getActorPhotoUrl(ev.actor_avitag));
      } else if (ev.trigger_type === 'REACTION_MILESTONE') {
        // Your own gist hitting a milestone — there's no second party
        // here, so no actor at all, only the gist's own media.
        const count = (ev.data as { count?: number } | null)?.count ?? 0;
        itemLines.push(lines.milestoneItemLine(count));
        itemMedia.set(ev.event_id, await getGistMedia(ev.target_id));
      } else if ((ev.trigger_type === 'TRENDING_GIST' || ev.trigger_type === 'TRENDING_AMEBO') && ev.actor_avitag) {
        // The campus comparison (trending-gist vs Amebo framing) is read
        // straight off the gist's OWN stored campus_tag, independent of
        // whether its poster is shown by name — anonymity hides the WHO,
        // never the WHERE, so an anonymous same-campus post still reads
        // as "trending gist," not incorrectly as "Amebo."
        const { anonymous, campus_tag: gistCampus } = await getGistAnonymityAndCampus(ev.target_id);
        const actor = anonymous ? null : await getProfileSummary(ev.actor_avitag);
        const recipientProfile = await getProfileSummary(recipient);
        const sameSchool = !!gistCampus && gistCampus === recipientProfile?.campus_tag;
        itemLines.push(lines.trendingItemLine(actor?.name ?? 'Somebody', sameSchool));
        itemMedia.set(ev.event_id, await getGistMedia(ev.target_id));
        itemActorAvitag.set(ev.event_id, anonymous ? null : ev.actor_avitag);
        itemActorPhoto.set(ev.event_id, anonymous ? null : await getActorPhotoUrl(ev.actor_avitag));
      } else if (ev.trigger_type === 'SPOT_LIKES' && ev.actor_avitag) {
        const actor = await getProfileSummary(ev.actor_avitag);
        itemLines.push(lines.spotItemLine(actor?.name ?? 'Somebody'));
        itemMedia.set(ev.event_id, await getSpotMedia(ev.target_id));
        itemActorAvitag.set(ev.event_id, ev.actor_avitag);
        itemActorPhoto.set(ev.event_id, await getActorPhotoUrl(ev.actor_avitag));
      }
    }
    if (itemLines.length === 0) {
      await repo.markEventsProcessed(events.map((e) => e.event_id));
      return;
    }

    const kappyLine = `${lines.digestIntroLine(itemLines.length)} — ${itemLines.join('; ')}`;
    const notification = await repo.insertNotification({
      recipient_avitag: recipient,
      category: 'DIGEST',
      kappy_line: kappyLine,
      image_kind: 'KAPPY',
      // A digest bundles several different targets — there's no single
      // "the" thing to navigate to, so it has no target of its own. The
      // inbox UI lists each bundled item with its own link instead (see
      // payload below).
      target_type: null,
      target_id: null,
      payload: {
        items: events.map((e) => {
          const media = itemMedia.get(e.event_id) ?? NO_MEDIA;
          return {
            trigger_type: e.trigger_type,
            target_type: e.target_type,
            target_id: e.target_id,
            actor_avitag: itemActorAvitag.get(e.event_id) ?? null,
            actor_image_url: itemActorPhoto.get(e.event_id) ?? null,
            image_kind: media.image_kind,
            image_url: media.image_url,
          };
        }),
      },
    });
  pushLive(recipient, notification);
  await repo.markEventsProcessed(events.map((e) => e.event_id));
}

// ---------------------------------------------------------------------------
// HOT_EXPIRING — time-based instant trigger, see index.ts for the cron.
// ---------------------------------------------------------------------------

export async function checkHotExpiring(): Promise<void> {
  const { rows: expiring } = await pool.query<{ hot_post_id: string; avitag: string }>(
    `SELECT hot_post_id, avitag FROM hot_posts
     WHERE created_at <= NOW() - INTERVAL '22 hours' AND created_at > NOW() - INTERVAL '24 hours'`
  );
  for (const post of expiring) {
    const circle = await findCloseCircle(post.avitag);
    if (circle.length === 0) continue;
    const { rows: seen } = await pool.query<{ avitag: string }>(
      `SELECT avitag FROM hot_post_seen WHERE hot_post_id = $1 AND avitag = ANY($2::text[])`,
      [post.hot_post_id, circle]
    );
    const seenSet = new Set(seen.map((s) => s.avitag));
    const unseen = circle.filter((a) => !seenSet.has(a));
    if (unseen.length === 0) continue;
    if (await repo.milestoneAlreadyNotified('HOT_POST', post.hot_post_id, 'hot_expiring_sent')) continue;
    await repo.recordMilestone('HOT_POST', post.hot_post_id, 'hot_expiring_sent');
    const poster = await getProfileSummary(post.avitag);
    for (const recipient of unseen) {
      await fireInstant({
        recipient,
        actor: post.avitag,
        triggerType: 'HOT_EXPIRING',
        category: 'HOT_EXPIRING',
        targetType: 'HOT_POST',
        targetId: post.hot_post_id,
        buildLine: async () => lines.hotExpiringLine(poster?.name ?? 'Somebody'),
        // Both: the Hot post's own media (it's about to disappear) AND
        // the poster's own face.
        resolveContent: () => getHotPostMedia(post.hot_post_id),
        resolveActorPhoto: () => getActorPhotoUrl(post.avitag),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Periodic nudges — pure clock-driven, no notification_events row at all.
// ---------------------------------------------------------------------------

export async function runInactivityNudges(): Promise<void> {
  const { rows } = await pool.query<{ account_id: string; avitag: string }>(
    `SELECT a.account_id, sp.avitag FROM accounts a
     JOIN student_profiles sp ON sp.account_id = a.account_id AND sp.profile_status = 'ACTIVE'
     WHERE a.account_status = 'ACTIVE' AND (a.last_active_at IS NULL OR a.last_active_at < NOW() - INTERVAL '3 days')`
  );
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  for (const r of rows) {
    if (await isMuted(r.avitag, 'INACTIVITY_NUDGE')) continue;
    // Only re-fire once per fresh 3-day mark of CONTINUED inactivity, not
    // every time this cron tick happens to run while someone's still away.
    if (await repo.hasNotificationSince(r.avitag, 'INACTIVITY_NUDGE', threeDaysAgo)) continue;
    const profile = await getProfileSummary(r.avitag);
    const notification = await repo.insertNotification({
      recipient_avitag: r.avitag,
      category: 'INACTIVITY_NUDGE',
      kappy_line: lines.inactivityLine(profile?.name ?? 'Ayo'),
      image_kind: 'KAPPY',
    });
    pushLive(r.avitag, notification);
  }
}

export async function runActivationNudges(): Promise<void> {
  const hour = new Date().getHours();
  if (hour < 12 || hour >= 16) return;
  const { rows } = await pool.query<{ avitag: string }>(
    `SELECT sp.avitag FROM student_profiles sp
     JOIN accounts a ON a.account_id = sp.account_id
     WHERE sp.profile_status = 'ACTIVE' AND a.account_status = 'ACTIVE'`
  );
  // Once every 2 days, AND never twice within the same day's 12pm-4pm
  // window even if this cron tick runs more than once inside it.
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  for (const r of rows) {
    if (await isMuted(r.avitag, 'ACTIVATION_NUDGE')) continue;
    if (await repo.hasNotificationSince(r.avitag, 'ACTIVATION_NUDGE', twoDaysAgo)) continue;
    const profile = await getProfileSummary(r.avitag);
    const notification = await repo.insertNotification({
      recipient_avitag: r.avitag,
      category: 'ACTIVATION_NUDGE',
      kappy_line: lines.activationLine(profile?.name ?? 'Ayo'),
      image_kind: 'KAPPY',
    });
    pushLive(r.avitag, notification);
  }
}

export async function cleanupOld(): Promise<void> {
  const deleted = await repo.deleteOlderThan(30);
  if (deleted > 0) logger.info({ deleted }, 'notification.service: cleaned up old notifications');
}
