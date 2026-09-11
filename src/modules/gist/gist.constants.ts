// Mirrors kampos-web's lib/brand.ts GIST_COLOR_KEYS, same order — kept in
// sync by hand since these are two separate repos/languages. Single source
// within this backend (schema validation + controller whitelist both import
// this) so it's at least not triplicated here too.
export const GIST_COLOR_KEYS = [
  'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink',
] as const;

// A poll option is a short label, not a second gist_text — the question
// itself (gist_text) already carries the real content. 25 chars matches
// X's own poll-option cap — short labels read better as option buttons
// than a wrapping sentence would.
export const POLL_OPTION_MAX_LEN = 25;
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;

// A poll's gist_text is the question framing it, not the post's real
// content the way it is for a text/media gist — the options ARE the
// content. 150 is generous for a full question while keeping the composer
// (and the posted card) from having to carry a full 700-char essay above
// a set of poll options at the same time.
export const POLL_GIST_TEXT_MAX_LEN = 150;
