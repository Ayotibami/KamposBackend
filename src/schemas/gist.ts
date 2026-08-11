import { z } from 'zod';
import { GIST_COLOR_KEYS } from '../modules/gist/gist.constants';

export const createGistSchema = z.object({
  gist_text: z.string().min(1),
  // Optional poster pick for the short-text hero color — z.object strips
  // any key not declared here by default, so without this line the field
  // was silently deleted before the controller ever saw it, no matter what
  // was actually sent from the client.
  color_key: z.enum(GIST_COLOR_KEYS).nullable().optional(),
});

export const updateGistSchema = z.object({
  gist_text: z.string().min(1).optional(),
});

export const reportGistSchema = z.object({
  reason: z.string().min(1).max(500).optional().nullable(),
});
