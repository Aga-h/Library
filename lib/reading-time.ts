import { LANGUAGE_CONFIG, type LanguageKey } from "./constants/languages";

export interface ReadingTime {
  minutes: number;
  hours: number;
  days: number;
  formatted: string;
}

/**
 * Calculate estimated reading time for a book.
 * Uses average words-per-page × pages / WPM for the given language.
 */
export function calculateReadingTime(
  pages: number,
  language: LanguageKey
): ReadingTime {
  const config = LANGUAGE_CONFIG[language];
  const totalUnits = pages * config.unitsPerPage;
  const minutes = Math.round(totalUnits / config.wpm);
  const hours = minutes / 60;
  const days = hours / 24;

  return {
    minutes,
    hours,
    days,
    formatted: formatReadingTime(minutes),
  };
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

/**
 * Sum up reading times across multiple books.
 */
export function sumReadingTime(
  books: Array<{ pages: number; language: string }>
): ReadingTime {
  const totalMinutes = books.reduce((acc, book) => {
    const time = calculateReadingTime(book.pages, book.language as LanguageKey);
    return acc + time.minutes;
  }, 0);

  return {
    minutes: totalMinutes,
    hours: totalMinutes / 60,
    days: totalMinutes / (60 * 24),
    formatted: formatReadingTime(totalMinutes),
  };
}
