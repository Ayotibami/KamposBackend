import { z } from 'zod';

// Mirrors the frontend's validateAvitag (kampos-web/src/lib/validation.ts) —
// same rule set most social platforms use (X/Twitter etc): letters, numbers,
// underscores only, no emoji in the handle itself, must contain a letter.
// Backend needs its own copy of this since avitag is the primary key on the
// profile tables — the frontend check alone doesn't stop a non-browser
// client (curl, a future mobile build, etc) from writing an invalid one.
const AVITAG_MIN = 4;
const AVITAG_MAX = 15;
const AVITAG_CHARSET_RE = /^[a-z0-9_]+$/;
const HAS_LETTER_RE = /[a-z]/;
// Zero-width characters stripped before validating (U+200B–U+200D, U+FEFF).
const ZERO_WIDTH_RE = new RegExp('[\\u200B-\\u200D\\uFEFF]', 'g');

// kampos-web serves a profile at the root — /avitag, no /profile prefix —
// so an avitag matching one of that app's own top-level route segments
// would make that profile permanently unreachable (its router always
// matches a static route over the dynamic [avitag] catch-all). Mirrored by
// hand in kampos-web's lib/validation.ts since that's a separate repo —
// keep both in sync if either list changes. This is the real enforcement
// point; the frontend copy is just early UX.
const RESERVED_AVITAGS = new Set([
  'login',
  'signup',
  'feed',
  'settings',
  'gist',
  'api',
  'profile',
  'kampos',
  'kappy',
  'ceo',
  'admin',
  'test',
]);

function normalizeAvitag(raw: string): string {
  return raw.trim().toLowerCase().replace(ZERO_WIDTH_RE, '').normalize('NFC');
}

export const avitagSchema = z
  .string()
  .transform((raw) => normalizeAvitag(raw))
  .refine((v) => v.length >= AVITAG_MIN && v.length <= AVITAG_MAX, {
    message: `Avitag must be ${AVITAG_MIN}-${AVITAG_MAX} characters.`,
  })
  .refine((v) => AVITAG_CHARSET_RE.test(v), {
    message: 'Avitag can only contain letters, numbers, and underscores.',
  })
  .refine((v) => HAS_LETTER_RE.test(v), {
    message: 'Avitag must contain at least one letter.',
  })
  .refine((v) => !v.startsWith('_'), { message: 'Avitag cannot start with an underscore.' })
  .refine((v) => !v.endsWith('_'), { message: 'Avitag cannot end with an underscore.' })
  .refine((v) => !v.includes('__'), { message: 'Avitag cannot contain two underscores in a row.' })
  .refine((v) => !RESERVED_AVITAGS.has(v), { message: 'That avitag is reserved, please pick another.' });

export const studentCreateSchema = z.object({
  avitag: avitagSchema,
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  display_name: z.string().optional().nullable(),
  campus_tag: z.string().optional().nullable(),
  major_tag: z.string().optional().nullable(),
  level: z.union([z.coerce.number().int(), z.string()]).optional().nullable(),
  bio: z.string().optional().nullable(),
  hobbies: z.union([z.array(z.string()), z.string()]).optional().nullable(),
  degree: z.enum(['BACHELORS','MASTERS','PHD']).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
});

export const kreatorCreateSchema = z.object({
  avitag: avitagSchema,
  display_name: z.string().min(1),
  campustag: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
});

export const kompanyCreateSchema = z.object({
  avitag: avitagSchema,
  display_name: z.string().min(1),
  email: z.string().email(),
  phone_number: z.string().min(3),
  website: z.string().url(),
  social_links: z.any().optional().nullable(),
  description: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
});

export const schoolCreateSchema = z.object({
  avitag: avitagSchema,
  display_name: z.string().min(1),
  campus_tag: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
});
