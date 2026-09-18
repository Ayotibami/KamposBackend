import { z } from 'zod';
import {
  GIST_COLOR_KEYS,
  POLL_OPTION_MAX_LEN,
  POLL_MIN_OPTIONS,
  POLL_MAX_OPTIONS,
  POLL_GIST_TEXT_MAX_LEN,
} from '../modules/gist/gist.constants';

// Same "z.object strips anything not declared" reasoning as color_key
// below — without this, a poll payload would silently vanish before the
// controller ever saw it. `options.length` bounds live here (schema-level)
// rather than only in the controller, same belt-and-braces color_key
// already gets against a crafted request.
const createPollSchema = z.object({
  options: z.array(z.string().trim().min(1).max(POLL_OPTION_MAX_LEN)).min(POLL_MIN_OPTIONS).max(POLL_MAX_OPTIONS),
});

export const createGistSchema = z
  .object({
    gist_text: z.string().min(1),
    // Optional poster pick for the short-text hero color — z.object strips
    // any key not declared here by default, so without this line the field
    // was silently deleted before the controller ever saw it, no matter what
    // was actually sent from the client.
    color_key: z.enum(GIST_COLOR_KEYS).nullable().optional(),
    poll: createPollSchema.optional(),
    // Create-only, same as color_key/poll — there's no edit-a-gist-into-
    // anonymous (or back out) flow, so updateGistSchema below never
    // declares this at all. Actual eligibility (must the poster be
    // OTP-verified) is already enforced by requireOtpVerified on this
    // route for every gist regardless of this flag, so nothing extra is
    // needed here beyond accepting the boolean.
    is_anonymous: z.boolean().optional(),
    // Yarn back (quote-repost) — the gist being quoted. Create-only, same
    // as is_anonymous/color_key/poll above; there's no edit-a-gist-into-
    // a-repost flow either. z.object strips anything not declared here,
    // same reasoning color_key's own comment already gives — without
    // this the field was silently deleted before the controller ever saw
    // it. The referenced gist's actual existence is enforced by the DB's
    // own FK constraint (migration 0043) at insert time, not re-checked
    // here — a malformed/nonexistent id just fails the insert.
    quoted_gist_id: z.string().uuid().nullable().optional(),
  })
  // A poll gist's text is capped shorter than a normal gist's — see
  // POLL_GIST_TEXT_MAX_LEN's own doc. Checked here rather than on
  // gist_text itself since the cap only applies once a poll is attached.
  .refine((data) => !data.poll || data.gist_text.length <= POLL_GIST_TEXT_MAX_LEN, {
    message: `A poll's question can be at most ${POLL_GIST_TEXT_MAX_LEN} characters`,
    path: ['gist_text'],
  });

export const updateGistSchema = z.object({
  gist_text: z.string().min(1).optional(),
});

export const reportGistSchema = z.object({
  reason: z.string().min(1).max(500).optional().nullable(),
});
