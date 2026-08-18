BEGIN;

-- ─── Comics: replace the old flat table with the four-level hierarchy ─────────
DROP TABLE IF EXISTS "Comic";
DROP TYPE  IF EXISTS "ComicStatus";

CREATE TABLE IF NOT EXISTS "ComicPublisher" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "coverImage" TEXT,
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComicPublisher_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ComicPublisher_name_key" ON "ComicPublisher"("name");

CREATE TABLE IF NOT EXISTS "ComicUniverse" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "publisherId" TEXT NOT NULL,
  "coverImage"  TEXT,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComicUniverse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ComicUniverse_publisherId_fkey" FOREIGN KEY ("publisherId")
    REFERENCES "ComicPublisher"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ComicUniverse_publisherId_name_key"
  ON "ComicUniverse"("publisherId", "name");

CREATE TABLE IF NOT EXISTS "ComicTitle" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "universeId" TEXT NOT NULL,
  "author"     TEXT,
  "artist"     TEXT,
  "language"   "Language" NOT NULL DEFAULT 'ENGLISH',
  "coverImage" TEXT,
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComicTitle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ComicTitle_universeId_fkey" FOREIGN KEY ("universeId")
    REFERENCES "ComicUniverse"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ComicTitle_universeId_name_key"
  ON "ComicTitle"("universeId", "name");

CREATE TABLE IF NOT EXISTS "ComicIssue" (
  "id"          TEXT NOT NULL,
  "titleId"     TEXT NOT NULL,
  "issueNumber" DOUBLE PRECISION NOT NULL,
  "name"        TEXT,
  "read"        BOOLEAN NOT NULL DEFAULT false,
  "owned"       BOOLEAN NOT NULL DEFAULT false,
  "coverImage"  TEXT,
  "rating"      DOUBLE PRECISION,
  "releaseDate" TIMESTAMP(3),
  "timesReread" INTEGER NOT NULL DEFAULT 0,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComicIssue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ComicIssue_titleId_fkey" FOREIGN KEY ("titleId")
    REFERENCES "ComicTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ComicIssue_titleId_issueNumber_key"
  ON "ComicIssue"("titleId", "issueNumber");

-- If ComicIssue already existed from an earlier partial run, make sure the column is there.
ALTER TABLE "ComicIssue" ADD COLUMN IF NOT EXISTS "timesReread" INTEGER NOT NULL DEFAULT 0;

-- ─── Recurring subscriptions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Subscription" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "amount"         DOUBLE PRECISION NOT NULL,
  "startYear"      INTEGER NOT NULL,
  "startMonth"     INTEGER NOT NULL,
  "cancelledYear"  INTEGER,
  "cancelledMonth" INTEGER,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- ─── Index tuning ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Garment_type_wornCount_idx" ON "Garment"("type", "wornCount" DESC);
CREATE INDEX IF NOT EXISTS "Garment_createdAt_idx"      ON "Garment"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Anime_language_createdAt_idx" ON "Anime"("language", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Expense_year_month_createdAt_idx"
  ON "Expense"("year", "month", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AdditionalIncome_year_month_createdAt_idx"
  ON "AdditionalIncome"("year", "month", "createdAt" DESC);

-- superseded by the composite indexes above
DROP INDEX IF EXISTS "Expense_year_month_idx";
DROP INDEX IF EXISTS "Expense_createdAt_idx";
DROP INDEX IF EXISTS "AdditionalIncome_year_month_idx";

COMMIT;
