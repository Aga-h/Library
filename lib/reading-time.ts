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




// ─── MANGA ───────────────────────────────────────────────────────────────────

// Calibrated to MAL benchmark: 20,533 ch = 123.99 days → ~8.69 min/chapter
const MINUTES_PER_MANGA_CHAPTER = 8.7;

export function calculateMangaTime(
  chaptersRead: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _language: LanguageKey
): ReadingTime {
  return makeReadingTime(Math.round(chaptersRead * MINUTES_PER_MANGA_CHAPTER));
}


// ─── COMICS ──────────────────────────────────────────────────────────────────

// Comics are equally visual; use same benchmark as manga
const MINUTES_PER_COMIC_ISSUE = 8.7;

export function calculateComicTime(
  issuesRead: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _language: LanguageKey
): ReadingTime {
  return makeReadingTime(Math.round(issuesRead * MINUTES_PER_COMIC_ISSUE));
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

