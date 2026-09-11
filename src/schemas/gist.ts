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
