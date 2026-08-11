// Mirrors kampos-web's lib/brand.ts GIST_COLOR_KEYS, same order — kept in
// sync by hand since these are two separate repos/languages. Single source
// within this backend (schema validation + controller whitelist both import
// this) so it's at least not triplicated here too.
export const GIST_COLOR_KEYS = [
  'red', 'orange', 'yellow', 'lime', 'green', 'teal',
  'cyan', 'blue', 'indigo', 'purple', 'pink', 'neutral',
] as const;
