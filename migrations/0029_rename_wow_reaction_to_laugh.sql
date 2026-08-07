-- 0029_rename_wow_reaction_to_laugh.sql
-- Replace the WOW reaction with a laughter emoji — RENAME VALUE (not
-- drop/recreate) so any reactions already stored as WOW become LAUGH in
-- place, instead of orphaning existing rows.

ALTER TYPE reaction_type RENAME VALUE 'WOW' TO 'LAUGH';
