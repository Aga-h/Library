-- The whole schema for a NEW, EMPTY database, for a copy of this site. Paste it into
-- Supabase → SQL Editor and run it once. Not for the existing database: that one is kept current
-- by manual-migrations/, and this would fail on tables that already exist.
--
-- Generated from schema.prisma, then row level security turned on for every table, as the
-- manual migrations do, so the Supabase anon key can't read them. The app connects as the
-- database owner and is unaffected. Regenerate after a schema change with:
--   npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
-- and keep the RLS block at the end in step with the tables.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('READ', 'READING', 'WANT_TO_READ');

-- CreateEnum
CREATE TYPE "AnimeStatus" AS ENUM ('WATCHING', 'COMPLETED', 'PLAN_TO_WATCH');

-- CreateEnum
CREATE TYPE "AnimeSeason" AS ENUM ('WINTER', 'SPRING', 'SUMMER', 'FALL');

-- CreateEnum
CREATE TYPE "MovieStatus" AS ENUM ('WATCHED', 'WANT_TO_WATCH', 'DROPPED');

-- CreateEnum
CREATE TYPE "TvStatus" AS ENUM ('WATCHING', 'COMPLETED', 'PLAN_TO_WATCH');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('PLAYING', 'COMPLETED', 'PLAN_TO_PLAY', 'DROPPED', 'PLATINUM');

-- CreateEnum
CREATE TYPE "GamePlatform" AS ENUM ('PC', 'MAC', 'STEAM_DECK', 'PS5', 'PS4', 'PS3', 'PS2', 'PS1', 'PSP', 'PS_VITA', 'XBOX_SERIES_X', 'XBOX_SERIES_S', 'XBOX_ONE_X', 'XBOX_ONE_S', 'XBOX_ONE', 'XBOX_360', 'XBOX', 'SWITCH_2', 'SWITCH', 'SWITCH_OLED', 'SWITCH_LITE', 'WII_U', 'WII', 'GAMECUBE', 'N64', 'SNES', 'NES', 'NINTENDO_3DS', 'DS', 'GBA', 'GBC', 'GAMEBOY', 'SEGA_DREAMCAST', 'SEGA_SATURN', 'SEGA_GENESIS', 'GAME_GEAR', 'IOS', 'ANDROID', 'OTHER');

-- CreateEnum
CREATE TYPE "MangaFormat" AS ENUM ('MANGA', 'MANHWA', 'MANHUA');

-- CreateEnum
CREATE TYPE "MangaStatus" AS ENUM ('READING', 'COMPLETED', 'PLAN_TO_READ');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('READ', 'WANT_TO_READ');

-- CreateEnum
CREATE TYPE "GarmentType" AS ENUM ('TOPS', 'BOTTOMS', 'OUTERWEAR', 'UNDERWEAR', 'SOCKS', 'ACTIVEWEAR', 'FORMALWEAR', 'ACCESSORIES', 'OTHER');

-- CreateEnum
CREATE TYPE "ColorGroup" AS ENUM ('WHITE', 'LIGHT', 'DARK', 'VIVID', 'MIXED');

-- CreateEnum
CREATE TYPE "WashMethod" AS ENUM ('MACHINE', 'HAND', 'DRY_CLEAN', 'DO_NOT_WASH');

-- CreateEnum
CREATE TYPE "WashTemp" AS ENUM ('COLD', 'W30', 'W40', 'W60', 'W90');

-- CreateEnum
CREATE TYPE "WashCycle" AS ENUM ('NORMAL', 'GENTLE');

-- CreateEnum
CREATE TYPE "SpinLevel" AS ENUM ('NORMAL', 'REDUCED', 'NONE');

-- CreateEnum
CREATE TYPE "DryMethod" AS ENUM ('TUMBLE_HIGH', 'TUMBLE_MEDIUM', 'TUMBLE_LOW', 'AIR_LINE', 'AIR_FLAT', 'AIR_DRIP', 'DRY_CLEAN', 'DO_NOT_DRY');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FOOD', 'BOOKS', 'EDUCATION', 'ENTERTAINMENT', 'CLOTHING', 'SUBSCRIPTIONS', 'SELF_CARE', 'TRANSPORTATION', 'OTHER', 'CASH');

-- CreateEnum
CREATE TYPE "FundSource" AS ENUM ('BASE', 'EXTRA');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'SPANISH', 'FRENCH', 'GERMAN', 'ITALIAN', 'PORTUGUESE', 'TURKISH', 'ARABIC', 'RUSSIAN', 'JAPANESE', 'CHINESE', 'KOREAN');

-- CreateEnum
CREATE TYPE "Stat" AS ENUM ('STRENGTH', 'DEXTERITY', 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA', 'RESOLVE', 'INTUITION', 'COMPOSURE', 'WILLPOWER', 'ESSENCE', 'LOGIC', 'RESONANCE', 'MAGIC');

-- CreateEnum
CREATE TYPE "StudyTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "StudyTaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VocabRunKind" AS ENUM ('FULL', 'QUICK');

-- CreateEnum
CREATE TYPE "VocabVerdict" AS ENUM ('DONE', 'AMBIGUOUS', 'TO_REVIEW');

-- CreateEnum
CREATE TYPE "VocabCardState" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'RELEARNING');

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "status" "BookStatus" NOT NULL DEFAULT 'WANT_TO_READ',
    "owned" BOOLEAN NOT NULL DEFAULT false,
    "ownedKindle" BOOLEAN NOT NULL DEFAULT false,
    "language" "Language" NOT NULL DEFAULT 'ENGLISH',
    "publisher" TEXT,
    "pages" INTEGER NOT NULL,
    "pagesRead" INTEGER NOT NULL DEFAULT 0,
    "coverImage" TEXT,
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "timesReread" INTEGER NOT NULL DEFAULT 0,
    "openLibraryId" TEXT,
    "googleBooksId" TEXT,
    "seriesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookSeries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "universeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookUniverse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookUniverse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anime" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "studio" TEXT,
    "status" "AnimeStatus" NOT NULL DEFAULT 'PLAN_TO_WATCH',
    "episodes" INTEGER,
    "episodesWatched" INTEGER NOT NULL DEFAULT 0,
    "episodeDuration" INTEGER NOT NULL DEFAULT 24,
    "season" "AnimeSeason",
    "year" INTEGER,
    "language" "Language" NOT NULL DEFAULT 'JAPANESE',
    "coverImage" TEXT,
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "timesRewatched" INTEGER NOT NULL DEFAULT 0,
    "seasonNumber" INTEGER,
    "malId" INTEGER,
    "seriesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movie" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "director" TEXT,
    "studio" TEXT,
    "status" "MovieStatus" NOT NULL DEFAULT 'WANT_TO_WATCH',
    "runtime" INTEGER NOT NULL,
    "year" INTEGER,
    "language" "Language" NOT NULL DEFAULT 'ENGLISH',
    "coverImage" TEXT,
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "timesRewatched" INTEGER NOT NULL DEFAULT 0,
    "tmdbId" INTEGER,
    "imdbId" TEXT,
    "universeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieUniverse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovieUniverse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TvShow" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "creator" TEXT,
    "network" TEXT,
    "status" "TvStatus" NOT NULL DEFAULT 'PLAN_TO_WATCH',
    "totalEpisodes" INTEGER,
    "episodesWatched" INTEGER NOT NULL DEFAULT 0,
    "episodeRuntime" INTEGER NOT NULL DEFAULT 45,
    "year" INTEGER,
    "language" "Language" NOT NULL DEFAULT 'ENGLISH',
    "coverImage" TEXT,
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "timesRewatched" INTEGER NOT NULL DEFAULT 0,
    "seasonNumber" INTEGER,
    "seriesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TvShow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "developer" TEXT,
    "publisher" TEXT,
    "status" "GameStatus" NOT NULL DEFAULT 'PLAN_TO_PLAY',
    "platform" "GamePlatform" NOT NULL DEFAULT 'PC',
    "emulated" BOOLEAN NOT NULL DEFAULT false,
    "hoursPlayed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "achievementsUnlocked" INTEGER NOT NULL DEFAULT 0,
    "achievementsTotal" INTEGER,
    "coverImage" TEXT,
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "steamAppId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manga" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "artist" TEXT,
    "publisher" TEXT,
    "status" "MangaStatus" NOT NULL DEFAULT 'PLAN_TO_READ',
    "format" "MangaFormat" NOT NULL DEFAULT 'MANGA',
    "totalVolumes" INTEGER,
    "volumesRead" INTEGER NOT NULL DEFAULT 0,
    "totalChapters" INTEGER,
    "chaptersRead" INTEGER NOT NULL DEFAULT 0,
    "ongoing" BOOLEAN NOT NULL DEFAULT false,
    "language" "Language" NOT NULL DEFAULT 'JAPANESE',
    "coverImage" TEXT,
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "timesReread" INTEGER NOT NULL DEFAULT 0,
    "malId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComicPublisher" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComicPublisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComicUniverse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComicUniverse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComicTitle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'ENGLISH',
    "comicVineId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComicTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComicIssue" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "issueNumber" DOUBLE PRECISION NOT NULL,
    "name" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "owned" BOOLEAN NOT NULL DEFAULT false,
    "coverImage" TEXT,
    "rating" DOUBLE PRECISION,
    "timesReread" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComicIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publication" TEXT,
    "url" TEXT,
    "status" "ArticleStatus" NOT NULL DEFAULT 'WANT_TO_READ',
    "wordCount" INTEGER NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'ENGLISH',
    "coverImage" TEXT,
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "timesReread" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Garment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GarmentType" NOT NULL DEFAULT 'OTHER',
    "brand" TEXT,
    "color" TEXT,
    "colorGroup" "ColorGroup" NOT NULL DEFAULT 'MIXED',
    "materials" TEXT NOT NULL,
    "washMethod" "WashMethod" NOT NULL DEFAULT 'MACHINE',
    "maxTemp" "WashTemp" NOT NULL DEFAULT 'W40',
    "washCycle" "WashCycle" NOT NULL DEFAULT 'NORMAL',
    "spinLevel" "SpinLevel" NOT NULL DEFAULT 'NORMAL',
    "dryMethod" "DryMethod" NOT NULL DEFAULT 'TUMBLE_LOW',
    "wornCount" INTEGER NOT NULL DEFAULT 0,
    "lastWashed" TIMESTAMP(3),
    "image" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Garment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealCheck" (
    "date" DATE NOT NULL,
    "meal" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealCheck_pkey" PRIMARY KEY ("date","meal")
);

-- CreateTable
CREATE TABLE "WaterIntake" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ml" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaterIntake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "monthlyBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "source" "FundSource" NOT NULL DEFAULT 'BASE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdditionalIncome" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdditionalIncome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "startYear" INTEGER NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "cancelledYear" INTEGER,
    "cancelledMonth" INTEGER,
    "source" "FundSource" NOT NULL DEFAULT 'BASE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "count" INTEGER NOT NULL,
    "startYear" INTEGER NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "source" "FundSource" NOT NULL DEFAULT 'BASE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "liked" TEXT,
    "disliked" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopProduct" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimeSeries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "universeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimeSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimeUniverse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimeUniverse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TvSeries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tmdbId" INTEGER,
    "imdbId" TEXT,
    "universeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TvSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TvUniverse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TvUniverse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "stats" "Stat"[],
    "weeklyGoalMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpAward" (
    "id" TEXT NOT NULL,
    "studySessionId" TEXT NOT NULL,
    "stat" "Stat" NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "weeklyGoalMinutes" INTEGER,
    "flashNewPerDay" INTEGER NOT NULL DEFAULT 20,
    "flashReviewsPerDay" INTEGER NOT NULL DEFAULT 200,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "moduleId" TEXT,
    "moduleTitle" TEXT,
    "stats" "Stat"[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "seconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApCourse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "series" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApUnit" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "weighting" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySubject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subjectId" TEXT,
    "categoryId" TEXT,
    "dueDate" DATE,
    "dueTime" TEXT,
    "priority" "StudyTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "StudyTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StudyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySubtask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudySubtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabWord" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabMeaning" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabMeaning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabRun" (
    "id" TEXT NOT NULL,
    "kind" "VocabRunKind" NOT NULL DEFAULT 'FULL',
    "pool" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "VocabRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabQuestion" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "meaningId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "optionIds" TEXT[],
    "chosenId" TEXT,
    "verdict" "VocabVerdict",
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "VocabQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabCard" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "state" "VocabCardState" NOT NULL DEFAULT 'NEW',
    "step" INTEGER NOT NULL DEFAULT 0,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "due" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "newOrder" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabReview" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "stateBefore" "VocabCardState" NOT NULL,
    "before" JSONB NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpaLesson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL,
    "h1Exam1" DOUBLE PRECISION,
    "h1Perf1" DOUBLE PRECISION,
    "h1Exam2" DOUBLE PRECISION,
    "h1Perf2" DOUBLE PRECISION,
    "h1Project" DOUBLE PRECISION,
    "h2Exam1" DOUBLE PRECISION,
    "h2Perf1" DOUBLE PRECISION,
    "h2Exam2" DOUBLE PRECISION,
    "h2Perf2" DOUBLE PRECISION,
    "h2Project" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GpaLesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Book_openLibraryId_key" ON "Book"("openLibraryId");

-- CreateIndex
CREATE UNIQUE INDEX "Book_googleBooksId_key" ON "Book"("googleBooksId");

-- CreateIndex
CREATE INDEX "Book_seriesId_idx" ON "Book"("seriesId");

-- CreateIndex
CREATE INDEX "Book_status_createdAt_idx" ON "Book"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Book_createdAt_idx" ON "Book"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Book_language_createdAt_idx" ON "Book"("language", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BookSeries_universeId_idx" ON "BookSeries"("universeId");

-- CreateIndex
CREATE UNIQUE INDEX "BookSeries_universeId_name_key" ON "BookSeries"("universeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BookUniverse_name_key" ON "BookUniverse"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Anime_malId_key" ON "Anime"("malId");

-- CreateIndex
CREATE INDEX "Anime_status_createdAt_idx" ON "Anime"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Anime_createdAt_idx" ON "Anime"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Anime_language_createdAt_idx" ON "Anime"("language", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Anime_seriesId_idx" ON "Anime"("seriesId");

-- CreateIndex
CREATE INDEX "Anime_seriesId_seasonNumber_idx" ON "Anime"("seriesId", "seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Movie_tmdbId_key" ON "Movie"("tmdbId");

-- CreateIndex
CREATE INDEX "Movie_universeId_idx" ON "Movie"("universeId");

-- CreateIndex
CREATE INDEX "Movie_status_createdAt_idx" ON "Movie"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Movie_createdAt_idx" ON "Movie"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MovieUniverse_name_key" ON "MovieUniverse"("name");

-- CreateIndex
CREATE INDEX "TvShow_status_createdAt_idx" ON "TvShow"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TvShow_createdAt_idx" ON "TvShow"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "TvShow_seriesId_idx" ON "TvShow"("seriesId");

-- CreateIndex
CREATE INDEX "TvShow_seriesId_seasonNumber_idx" ON "TvShow"("seriesId", "seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Game_steamAppId_key" ON "Game"("steamAppId");

-- CreateIndex
CREATE INDEX "Game_status_createdAt_idx" ON "Game"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Game_createdAt_idx" ON "Game"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Game_platform_createdAt_idx" ON "Game"("platform", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Manga_malId_key" ON "Manga"("malId");

-- CreateIndex
CREATE INDEX "Manga_status_createdAt_idx" ON "Manga"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Manga_createdAt_idx" ON "Manga"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Manga_language_createdAt_idx" ON "Manga"("language", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ComicPublisher_name_key" ON "ComicPublisher"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ComicUniverse_publisherId_name_key" ON "ComicUniverse"("publisherId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ComicTitle_universeId_name_key" ON "ComicTitle"("universeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ComicTitle_universeId_comicVineId_key" ON "ComicTitle"("universeId", "comicVineId");

-- CreateIndex
CREATE UNIQUE INDEX "ComicIssue_titleId_issueNumber_key" ON "ComicIssue"("titleId", "issueNumber");

-- CreateIndex
CREATE INDEX "Article_status_createdAt_idx" ON "Article"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Article_language_createdAt_idx" ON "Article"("language", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Garment_type_wornCount_idx" ON "Garment"("type", "wornCount" DESC);

-- CreateIndex
CREATE INDEX "Garment_createdAt_idx" ON "Garment"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "WaterIntake_date_idx" ON "WaterIntake"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_clientId_key" ON "Expense"("clientId");

-- CreateIndex
CREATE INDEX "Expense_year_month_createdAt_idx" ON "Expense"("year", "month", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdditionalIncome_year_month_createdAt_idx" ON "AdditionalIncome"("year", "month", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Shop_category_idx" ON "Shop"("category");

-- CreateIndex
CREATE INDEX "ShopProduct_shopId_idx" ON "ShopProduct"("shopId");

-- CreateIndex
CREATE INDEX "AnimeSeries_universeId_idx" ON "AnimeSeries"("universeId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeSeries_universeId_name_key" ON "AnimeSeries"("universeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeUniverse_name_key" ON "AnimeUniverse"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TvSeries_tmdbId_key" ON "TvSeries"("tmdbId");

-- CreateIndex
CREATE INDEX "TvSeries_universeId_idx" ON "TvSeries"("universeId");

-- CreateIndex
CREATE UNIQUE INDEX "TvSeries_universeId_name_key" ON "TvSeries"("universeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TvUniverse_name_key" ON "TvUniverse"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Module_title_key" ON "Module"("title");

-- CreateIndex
CREATE INDEX "Module_title_idx" ON "Module"("title");

-- CreateIndex
CREATE INDEX "XpAward_stat_idx" ON "XpAward"("stat");

-- CreateIndex
CREATE UNIQUE INDEX "XpAward_studySessionId_stat_key" ON "XpAward"("studySessionId", "stat");

-- CreateIndex
CREATE INDEX "StudySession_date_idx" ON "StudySession"("date");

-- CreateIndex
CREATE INDEX "StudySession_moduleId_idx" ON "StudySession"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "ApCourse_name_key" ON "ApCourse"("name");

-- CreateIndex
CREATE INDEX "ApCourse_position_idx" ON "ApCourse"("position");

-- CreateIndex
CREATE INDEX "ApUnit_courseId_idx" ON "ApUnit"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "ApUnit_courseId_number_key" ON "ApUnit"("courseId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "StudySubject_name_key" ON "StudySubject"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StudyCategory_name_key" ON "StudyCategory"("name");

-- CreateIndex
CREATE INDEX "StudyTask_dueDate_idx" ON "StudyTask"("dueDate");

-- CreateIndex
CREATE INDEX "StudyTask_status_idx" ON "StudyTask"("status");

-- CreateIndex
CREATE INDEX "StudyTask_subjectId_idx" ON "StudyTask"("subjectId");

-- CreateIndex
CREATE INDEX "StudyTask_categoryId_idx" ON "StudyTask"("categoryId");

-- CreateIndex
CREATE INDEX "StudySubtask_taskId_idx" ON "StudySubtask"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabWord_word_key" ON "VocabWord"("word");

-- CreateIndex
CREATE INDEX "VocabWord_word_idx" ON "VocabWord"("word");

-- CreateIndex
CREATE INDEX "VocabMeaning_wordId_idx" ON "VocabMeaning"("wordId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabMeaning_wordId_position_key" ON "VocabMeaning"("wordId", "position");

-- CreateIndex
CREATE INDEX "VocabRun_startedAt_idx" ON "VocabRun"("startedAt");

-- CreateIndex
CREATE INDEX "VocabRun_kind_startedAt_idx" ON "VocabRun"("kind", "startedAt");

-- CreateIndex
CREATE INDEX "VocabQuestion_runId_idx" ON "VocabQuestion"("runId");

-- CreateIndex
CREATE INDEX "VocabQuestion_meaningId_idx" ON "VocabQuestion"("meaningId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabQuestion_runId_position_key" ON "VocabQuestion"("runId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "VocabCard_wordId_key" ON "VocabCard"("wordId");

-- CreateIndex
CREATE INDEX "VocabCard_state_due_idx" ON "VocabCard"("state", "due");

-- CreateIndex
CREATE INDEX "VocabReview_reviewedAt_idx" ON "VocabReview"("reviewedAt");

-- CreateIndex
CREATE INDEX "VocabReview_cardId_idx" ON "VocabReview"("cardId");

-- CreateIndex
CREATE INDEX "GpaLesson_position_idx" ON "GpaLesson"("position");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BookSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookSeries" ADD CONSTRAINT "BookSeries_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "BookUniverse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anime" ADD CONSTRAINT "Anime_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "AnimeSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "MovieUniverse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TvShow" ADD CONSTRAINT "TvShow_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "TvSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComicUniverse" ADD CONSTRAINT "ComicUniverse_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "ComicPublisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComicTitle" ADD CONSTRAINT "ComicTitle_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "ComicUniverse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComicIssue" ADD CONSTRAINT "ComicIssue_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "ComicTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProduct" ADD CONSTRAINT "ShopProduct_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeSeries" ADD CONSTRAINT "AnimeSeries_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "AnimeUniverse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TvSeries" ADD CONSTRAINT "TvSeries_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "TvUniverse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpAward" ADD CONSTRAINT "XpAward_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApUnit" ADD CONSTRAINT "ApUnit_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ApCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyTask" ADD CONSTRAINT "StudyTask_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudySubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyTask" ADD CONSTRAINT "StudyTask_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StudyCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySubtask" ADD CONSTRAINT "StudySubtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "StudyTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabMeaning" ADD CONSTRAINT "VocabMeaning_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "VocabWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabQuestion" ADD CONSTRAINT "VocabQuestion_runId_fkey" FOREIGN KEY ("runId") REFERENCES "VocabRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabQuestion" ADD CONSTRAINT "VocabQuestion_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "VocabMeaning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabCard" ADD CONSTRAINT "VocabCard_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "VocabWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabReview" ADD CONSTRAINT "VocabReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "VocabCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security
ALTER TABLE "Book" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BookSeries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BookUniverse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Anime" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Movie" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MovieUniverse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TvShow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Game" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Manga" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComicPublisher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComicUniverse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComicTitle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComicIssue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Article" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Garment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MealCheck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WaterIntake" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinanceConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdditionalIncome" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Installment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShopProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnimeSeries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnimeUniverse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TvSeries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TvUniverse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Module" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "XpAward" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApCourse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApUnit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySubject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySubtask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VocabWord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VocabMeaning" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VocabRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VocabQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VocabCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VocabReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GpaLesson" ENABLE ROW LEVEL SECURITY;
