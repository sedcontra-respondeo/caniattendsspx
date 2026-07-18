-- D1 schema for feedback submissions
-- Apply with: wrangler d1 execute sspx-feedback --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS submissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL,
  stance      TEXT NOT NULL,      -- disagree | agree-strengthen | other
  article     TEXT NOT NULL,      -- 1..7 | general
  section     TEXT NOT NULL,      -- objection | sed-contra | respondeo | reply | whole-article | other
  message     TEXT NOT NULL,
  contact     TEXT,               -- optional, only if reader supplied it
  has_contact INTEGER NOT NULL DEFAULT 0,
  category    TEXT NOT NULL DEFAULT 'unclassified',
              -- substantive | encouragement | hostile-noise | explicit | threat | unclassified
  summary     TEXT,               -- Claude's 1-3 sentence summary when surfaced
  reason      TEXT                -- short classifier rationale / error note
);

CREATE INDEX IF NOT EXISTS idx_category ON submissions (category, has_contact);
CREATE INDEX IF NOT EXISTS idx_created ON submissions (created_at);
