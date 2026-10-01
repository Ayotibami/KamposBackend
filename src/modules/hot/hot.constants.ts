// Hot post limits — deliberately its own set, not shared with Gist's
// media.controller.ts constants or Spot's spot.constants.ts. A Hot video
// is a quick, incidental moment (matches the 3-minute cap the composer
// already enforces client-side at src/components/gist/EDeyHotComposer.tsx),
// longer than a gist's throwaway clip (120s) but well short of Spot's own
// dedicated-video-platform allowance (300s).
export const MAX_VIDEO_DURATION_SECONDS = 180;
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const TEXT_MAX_LEN = 1000;

// How long a post stays visible — every read-side query filters against
// this, computed at query time (`created_at > NOW() - this interval`),
// never stored as a column. See migration 0047's own doc comment for why.
export const VISIBLE_WINDOW = "24 hours";

// The sweep job (hot.sweep.ts) deletes anything past this, not 24h exactly
// — a small buffer so a request already mid-flight when a post crosses the
// visibility line never races a delete that's cleaning up the same row.
export const SWEEP_AFTER = "25 hours";
