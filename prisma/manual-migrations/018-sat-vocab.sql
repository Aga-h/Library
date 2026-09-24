-- Study section, first category: SAT vocabulary.
--
-- A word has one or more meanings, and every meaning becomes one question: "what does this word
-- mean", with the right meaning among four options. The three distractors are drawn only from
-- *other* words' meanings — another sense of the same word would be a second correct answer.
--
-- A run is one sitting of the test. The three categories (Done / Ambiguous / To Review) are just
-- the verdicts on the current run's questions, so starting a new run is what resets them, and
-- the old lists stay readable until then.
--
-- ADDITIVE: four new tables and one enum, touching nothing else. Run BEFORE deploying the code.
--
-- Idempotent: safe to run again.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VocabVerdict') THEN
    CREATE TYPE "VocabVerdict" AS ENUM ('DONE', 'AMBIGUOUS', 'TO_REVIEW');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "VocabWord" (
  "id"        TEXT NOT NULL,
  "word"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VocabWord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VocabWord_word_key" ON "VocabWord"("word");
CREATE INDEX        IF NOT EXISTS "VocabWord_word_idx" ON "VocabWord"("word");

CREATE TABLE IF NOT EXISTS "VocabMeaning" (
  "id"        TEXT NOT NULL,
  "wordId"    TEXT NOT NULL,
  "text"      TEXT NOT NULL,
  "position"  INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VocabMeaning_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VocabMeaning_wordId_position_key" ON "VocabMeaning"("wordId", "position");
CREATE INDEX        IF NOT EXISTS "VocabMeaning_wordId_idx"          ON "VocabMeaning"("wordId");

CREATE TABLE IF NOT EXISTS "VocabRun" (
  "id"         TEXT NOT NULL,
  "startedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "VocabRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VocabRun_startedAt_idx" ON "VocabRun"("startedAt");

CREATE TABLE IF NOT EXISTS "VocabQuestion" (
  "id"         TEXT NOT NULL,
  "runId"      TEXT NOT NULL,
  "meaningId"  TEXT NOT NULL,
  "position"   INTEGER NOT NULL,
  -- The four options as meaning ids, already shuffled, the correct one among them.
  "optionIds"  TEXT[],
  "chosenId"   TEXT,
  "verdict"    "VocabVerdict",
  "answeredAt" TIMESTAMP(3),
  CONSTRAINT "VocabQuestion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VocabQuestion_runId_position_key" ON "VocabQuestion"("runId", "position");
CREATE INDEX        IF NOT EXISTS "VocabQuestion_runId_idx"          ON "VocabQuestion"("runId");
CREATE INDEX        IF NOT EXISTS "VocabQuestion_meaningId_idx"      ON "VocabQuestion"("meaningId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VocabMeaning_wordId_fkey') THEN
    ALTER TABLE "VocabMeaning" ADD CONSTRAINT "VocabMeaning_wordId_fkey"
      FOREIGN KEY ("wordId") REFERENCES "VocabWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VocabQuestion_runId_fkey') THEN
    ALTER TABLE "VocabQuestion" ADD CONSTRAINT "VocabQuestion_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "VocabRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VocabQuestion_meaningId_fkey') THEN
    ALTER TABLE "VocabQuestion" ADD CONSTRAINT "VocabQuestion_meaningId_fkey"
      FOREIGN KEY ("meaningId") REFERENCES "VocabMeaning"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── Row level security ──────────────────────────────────────────────────────
-- As with 012-017: every other public table has RLS on, and a new table does not inherit it.
ALTER TABLE "VocabWord"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VocabMeaning"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VocabRun"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VocabQuestion" ENABLE ROW LEVEL SECURITY;

COMMIT;
