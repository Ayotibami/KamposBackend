// Spot's own limits — deliberately not shared with Gist's media constants
// (media.controller.ts's MAX_VIDEO_DURATION_SECONDS/MAX_VIDEO_BYTES).
// Spot is the dedicated video platform, so it gets more room than a
// gist's incidental video attachment.
export const MAX_VIDEO_DURATION_SECONDS = 300;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const CAPTION_MAX_LEN = 300;
