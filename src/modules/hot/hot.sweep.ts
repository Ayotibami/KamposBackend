import * as hotRepo from "./hot.repo";
import { deleteByPublicIdWithType } from "../../services/media/cloudinary";
import logger from "../../utils/logger";

// Purely storage hygiene — visibility is ALREADY correct the instant a
// post crosses 24h (every read filters `created_at > NOW() - INTERVAL
// '24 hours'`, see migration 0047's own doc comment), so this job changes
// nothing about what anyone sees. It just stops the row and its Cloudinary
// asset from sitting around forever after nobody can see them anymore.
// Runs on the clock hourly (see index.ts), same "fixed clock, not N hours
// after boot" reasoning digest.ts's own cron already uses, so a redeploy
// never shifts the schedule.
const BATCH_SIZE = 200;

export async function sweepExpiredHotPosts(): Promise<void> {
  try {
    const expired = await hotRepo.findExpiredForSweep(BATCH_SIZE);
    if (expired.length === 0) return;

    // Best-effort per-asset cleanup, same Promise.allSettled pattern every
    // other Cloudinary cleanup in this codebase uses — one failed delete
    // (an already-gone asset, a transient Cloudinary error) never blocks
    // the others or stops the DB rows from being cleaned up regardless.
    const cloudinaryResults = await Promise.allSettled(
      expired
        .filter((p) => p.public_id)
        .map((p) => deleteByPublicIdWithType(p.public_id as string, p.media_kind === "VIDEO" ? "video" : "image"))
    );
    const cloudinaryFailures = cloudinaryResults.filter((r) => r.status === "rejected").length;

    await hotRepo.deleteByIds(expired.map((p) => p.hot_post_id));

    logger.info(
      { swept: expired.length, cloudinaryFailures },
      "hot.sweep: cleaned up expired Hot posts"
    );
  } catch (err) {
    logger.error({ err }, "hot.sweep: sweep tick failed");
  }
}
