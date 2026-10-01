-- 0047_create_hot_posts_stack.sql
-- "As e dey hot": Instagram/WhatsApp-Stories-style posts that vanish 24h
-- after posting. No expires_at column on purpose — every read-side query
-- filters `created_at > NOW() - INTERVAL '24 hours'` instead, so a post
-- disappearing from every feed/profile/own-stack read is a WHERE clause,
-- not a separate flag anyone has to keep in sync. The row (and its
-- Cloudinary asset) do still need cleaning up eventually though — that's
-- hot.sweep.ts's job on an hourly cron, purely for storage hygiene, never
-- for visibility (visibility is already correct the instant 24h passes,
-- with zero help from that job).
--
-- No status enum (unlike spots.status) — a Hot post is fire-and-forget,
-- posted in one shot with no draft/trim step beforehand the way Spot's
-- video needs, so there's no "not yet published" state to represent.

CREATE TYPE hot_media_kind AS ENUM ('TEXT', 'PHOTO', 'VIDEO');

CREATE TABLE IF NOT EXISTS hot_posts (
  hot_post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avitag TEXT NOT NULL,
  media_kind hot_media_kind NOT NULL,
  -- The caption for PHOTO/VIDEO, or the whole content for TEXT — same
  -- column either way, same as gist_text/spot caption's single-field
  -- convention elsewhere in this codebase.
  text TEXT CHECK (text IS NULL OR char_length(text) <= 1000),
  -- All three null for a TEXT post.
  media_url TEXT,
  public_id TEXT,
  thumbnail_url TEXT,
  -- Only set for a TEXT post (the background swatch) — null for PHOTO/VIDEO.
  color_key TEXT,
  -- Only meaningful for VIDEO — Cloudinary's own reported length, not a
  -- client guess (see hot.controller.ts's `create`).
  duration_ms INTEGER,
  is_reported BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A TEXT post must actually have text; PHOTO/VIDEO must actually have a
  -- media_url — DB-level integrity, not just an application-layer check.
  CONSTRAINT hot_posts_text_kind_has_text
    CHECK (media_kind <> 'TEXT' OR (text IS NOT NULL AND char_length(text) >= 1)),
  CONSTRAINT hot_posts_media_kind_has_media
    CHECK (media_kind = 'TEXT' OR media_url IS NOT NULL)
);

-- Covers both "my own posts, newest window first" (hot.repo.ts's
-- listMine) and the sweep job's own "everything past the cutoff" scan.
CREATE INDEX IF NOT EXISTS idx_hot_posts_avitag_created ON hot_posts (avitag, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_hot_posts_created ON hot_posts (created_at ASC);

-- Who has seen which post — this one small table is the entire memory
-- behind both the ring's per-segment greying AND the viewer's resume/
-- restart logic (see EDeyHotViewer.tsx's resumeIndex, already built
-- entirely client-side against a `seen` boolean this table now backs for
-- real, instead of the session-only mock state it read before).
CREATE TABLE IF NOT EXISTS hot_post_seen (
  hot_post_id UUID NOT NULL REFERENCES hot_posts(hot_post_id) ON DELETE CASCADE,
  avitag TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (hot_post_id, avitag)
);
CREATE INDEX IF NOT EXISTS idx_hot_post_seen_avitag ON hot_post_seen (avitag);
