-- 0008_seed_campus_major_and_level_constraints.sql

-- Seed campus
INSERT INTO campus (campus_tag, campus_name) VALUES
  ('unilag', 'University of Lagos'),
  ('ui', 'University of Ibadan'),
  ('oau', 'Obafemi Awolowo University'),
  ('unn', 'University of Nigeria, Nsukka'),
  ('unilorin', 'University of Ilorin')
ON CONFLICT (campus_tag) DO NOTHING;

-- Seed majors
INSERT INTO major (major_tag, major_name) VALUES
  ('cs', 'Computer Science'),
  ('pos', 'Political Science'),
  ('mcb', 'Microbiology'),
  ('bch', 'Biochemistry'),
  ('eee', 'Electrical / Electronic Engineering')
ON CONFLICT (major_tag) DO NOTHING;

-- Add level constraints (allow only specific levels)
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_level_allowed CHECK (level IN (100,200,300,400,500,600));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE gists ADD CONSTRAINT gists_level_allowed CHECK (level IN (100,200,300,400,500,600));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
