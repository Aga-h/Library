export type LanguageKey =
  | "ENGLISH"
  | "SPANISH"
  | "FRENCH"
  | "GERMAN"
  | "ITALIAN"
  | "PORTUGUESE"
  | "TURKISH"
  | "ARABIC"
  | "RUSSIAN"
  | "JAPANESE"
  | "CHINESE"
  | "KOREAN";

export interface LanguageConfig {
  label: string;
  /** Words (or characters) per minute for average adult reader */
  wpm: number;
  /** Average words (or characters) per page */
  unitsPerPage: number;
}

export const LANGUAGE_CONFIG: Record<LanguageKey, LanguageConfig> = {
  ENGLISH:    { label: "English",    wpm: 238, unitsPerPage: 300 },
  SPANISH:    { label: "Spanish",    wpm: 278, unitsPerPage: 300 },
  FRENCH:     { label: "French",     wpm: 295, unitsPerPage: 300 },
  GERMAN:     { label: "German",     wpm: 260, unitsPerPage: 300 },
  ITALIAN:    { label: "Italian",    wpm: 285, unitsPerPage: 300 },
  PORTUGUESE: { label: "Portuguese", wpm: 250, unitsPerPage: 300 },
  TURKISH:    { label: "Turkish",    wpm: 184, unitsPerPage: 300 },
  ARABIC:     { label: "Arabic",     wpm: 138, unitsPerPage: 300 },
  RUSSIAN:    { label: "Russian",    wpm: 184, unitsPerPage: 300 },
  JAPANESE:   { label: "Japanese",   wpm: 357, unitsPerPage: 600 },
  CHINESE:    { label: "Chinese",    wpm: 255, unitsPerPage: 600 },
  KOREAN:     { label: "Korean",     wpm: 200, unitsPerPage: 500 },
};

export const LANGUAGE_OPTIONS = Object.entries(LANGUAGE_CONFIG).map(
  ([value, { label }]) => ({ value: value as LanguageKey, label })
);
