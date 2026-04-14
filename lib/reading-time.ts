import { LANGUAGE_CONFIG, type LanguageKey } from "./constants/languages";

export interface ReadingTime {
  minutes: number;
  hours: number;
  days: number;
  formatted: string;
}

/**
 * Format a duration in minutes into a human-readable string.
 * e.g. 378 → "6h 18m", 1500 → "1d 1h", 45 → "45m"
 */
export function formatReadingTime(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    const parts = [`${days}d`];
    if (hours > 0) parts.push(`${hours}h`);
    return parts.join(" ");
  }

  const parts = [`${hours}h`];
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function makeReadingTime(minutes: number): ReadingTime {
  return {
    minutes,
    hours: minutes / 60,
    days: minutes / (60 * 24),
    formatted: formatReadingTime(minutes),
  };
}

// ─── BOOKS ───────────────────────────────────────────────────────────────────

/**
 * Estimated reading time for a book.
 * Uses average words-per-page × pages / WPM for the given language.
 */
export function calculateReadingTime(
  pages: number,
  language: LanguageKey
): ReadingTime {
  const config = LANGUAGE_CONFIG[language];
  const totalUnits = pages * config.unitsPerPage;
  const minutes = Math.round(totalUnits / config.wpm);
  return makeReadingTime(minutes);
}

/**
 * Sum reading time across multiple books.
 */
export function sumReadingTime(
  books: Array<{ pages: number; language: string }>
): ReadingTime {
  const totalMinutes = books.reduce((acc, book) => {
    const time = calculateReadingTime(book.pages, book.language as LanguageKey);
    return acc + time.minutes;
  }, 0);
  return makeReadingTime(totalMinutes);
}

// ─── ANIME / MOVIES / TV ─────────────────────────────────────────────────────

/**
 * Total time watched for anime: episodes × duration per episode.
 */
export function calculateAnimeTime(
  episodesWatched: number,
  episodeDuration: number
): ReadingTime {
  return makeReadingTime(episodesWatched * episodeDuration);
}

/**
 * Watch time for a movie/TV show: total minutes (runtime or episodes × runtime).
 */
export function calculateVideoTime(totalMinutes: number): ReadingTime {
  return makeReadingTime(totalMinutes);
}

/**
 * Sum video time across multiple entries (anime / movies / TV).
 */
export function sumVideoTime(
  entries: Array<{ minutes: number }>
): ReadingTime {
  const total = entries.reduce((acc, e) => acc + e.minutes, 0);
  return makeReadingTime(total);
}

// ─── MANGA ───────────────────────────────────────────────────────────────────

const PAGES_PER_MANGA_CHAPTER = 20;

/**
 * Estimated reading time for manga.
 * chaptersRead × ~20 pages/chapter × language units/page / wpm
 */
export function calculateMangaTime(
  chaptersRead: number,
  language: LanguageKey
): ReadingTime {
  const config = LANGUAGE_CONFIG[language];
  const pages = chaptersRead * PAGES_PER_MANGA_CHAPTER;
  const totalUnits = pages * config.unitsPerPage;
  const minutes = Math.round(totalUnits / config.wpm);
  return makeReadingTime(minutes);
}

export function sumMangaTime(
  entries: Array<{ chaptersRead: number; language: string }>
): ReadingTime {
  const total = entries.reduce((acc, e) => {
    return acc + calculateMangaTime(e.chaptersRead, e.language as LanguageKey).minutes;
  }, 0);
  return makeReadingTime(total);
}

// ─── COMICS ──────────────────────────────────────────────────────────────────

const PAGES_PER_COMIC_ISSUE = 22;

/**
 * Estimated reading time for comics.
 * issuesRead × ~22 pages/issue × language units/page / wpm
 */
export function calculateComicTime(
  issuesRead: number,
  language: LanguageKey
): ReadingTime {
  const config = LANGUAGE_CONFIG[language];
  const pages = issuesRead * PAGES_PER_COMIC_ISSUE;
  const totalUnits = pages * config.unitsPerPage;
  const minutes = Math.round(totalUnits / config.wpm);
  return makeReadingTime(minutes);
}

export function sumComicTime(
  entries: Array<{ issuesRead: number; language: string }>
): ReadingTime {
  const total = entries.reduce((acc, e) => {
    return acc + calculateComicTime(e.issuesRead, e.language as LanguageKey).minutes;
  }, 0);
  return makeReadingTime(total);
}

// ─── ARTICLES ────────────────────────────────────────────────────────────────

/**
 * Estimated reading time for an article.
 * wordCount / wpm for the given language.
 */
export function calculateArticleTime(
  wordCount: number,
  language: LanguageKey
): ReadingTime {
  const config = LANGUAGE_CONFIG[language];
  const minutes = Math.round(wordCount / config.wpm);
  return makeReadingTime(minutes);
}

export function sumArticleTime(
  entries: Array<{ wordCount: number; language: string }>
): ReadingTime {
  const total = entries.reduce((acc, e) => {
    return acc + calculateArticleTime(e.wordCount, e.language as LanguageKey).minutes;
  }, 0);
  return makeReadingTime(total);
}
