// SAT vocabulary: parsing a pasted word list, and building the test from it.
//
// Pure and dependency-free, so both the API routes and the tests can use it without a database.

export interface ParsedWord {
  word: string;
  meanings: string[];
}

export interface ParseResult {
  words: ParsedWord[];
  /** Lines that could not be read, with their 1-based line number, so nothing fails silently. */
  skipped: { line: number; text: string; reason: string }[];
}

// A word and its meanings can be separated by any of these. Checked longest-first so an em dash
// wins over a hyphen, and " - " does not split a hyphenated word like "self-effacing".
const SEPARATORS = ["—", "–", "\t", ":", " - ", " – "];

/**
 * Reads a pasted list. One word per line:
 *
 *   abate — to lessen in intensity; to reduce in amount
 *   aberrant: deviating from the norm
 *
 * Meanings are split on ";" or on a numbered list ("1. … 2. …"). Blank lines are ignored.
 */
export function parseWordList(input: string): ParseResult {
  const words: ParsedWord[] = [];
  const skipped: ParseResult["skipped"] = [];
  const seen = new Map<string, ParsedWord>();

  input.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === "") return;

    const cut = firstSeparator(line);
    if (cut === null) {
      skipped.push({ line: index + 1, text: line, reason: "no separator between word and meaning" });
      return;
    }

    const word = line.slice(0, cut.at).trim().replace(/[.,;:]+$/, "");
    const rest = line.slice(cut.at + cut.token.length).trim();

    if (word === "") {
      skipped.push({ line: index + 1, text: line, reason: "no word before the separator" });
      return;
    }
    const meanings = splitMeanings(rest);
    if (meanings.length === 0) {
      skipped.push({ line: index + 1, text: line, reason: "no meaning after the separator" });
      return;
    }

    // The same word twice in one paste merges rather than colliding.
    const key = word.toLowerCase();
    const existing = seen.get(key);
    if (existing) {
      for (const meaning of meanings) {
        if (!existing.meanings.includes(meaning)) existing.meanings.push(meaning);
      }
      return;
    }
    const entry = { word, meanings };
    seen.set(key, entry);
    words.push(entry);
  });

  return { words, skipped };
}

function firstSeparator(line: string): { at: number; token: string } | null {
  let best: { at: number; token: string } | null = null;
  for (const token of SEPARATORS) {
    const at = line.indexOf(token);
    // A separator at position 0 would leave no word before it.
    if (at <= 0) continue;
    if (best === null || at < best.at || (at === best.at && token.length > best.token.length)) {
      best = { at, token };
    }
  }
  return best;
}

function splitMeanings(rest: string): string[] {
  // "1. one thing 2. another" — numbered senses, as dictionaries print them.
  const numbered = rest.split(/\s*\d+[.)]\s+/).map((s) => s.trim()).filter(Boolean);
  const parts = numbered.length > 1 ? numbered : rest.split(";");

  const out: string[] = [];
  for (const part of parts) {
    const meaning = part.trim().replace(/[.,;]+$/, "").trim();
    if (meaning !== "" && !out.includes(meaning)) out.push(meaning);
  }
  return out;
}

// ─── Building the test ───────────────────────────────────────────────────────

export const OPTIONS_PER_QUESTION = 4;

/**
 * Shorter runs on offer, for when the whole list is too much in one sitting.
 *
 * The whole list is offered alongside these and is what a run defaults to -- leaving `limit`
 * off `buildQuestions` asks about every meaning.
 */
export const RUN_LENGTHS = [25, 50, 100, 250] as const;

export interface MeaningRef {
  id: string;
  wordId: string;
  text: string;
}

export interface BuiltQuestion {
  meaningId: string;
  position: number;
  optionIds: string[];
}

export interface BuildOptions {
  /** How many questions to ask. Left out, it asks about every meaning in the list. */
  limit?: number;
  random?: () => number;
}

/** The same wording, ignoring case, spacing and trailing punctuation. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim();
}

/**
 * One question per meaning, shuffled, each with its distractors.
 *
 * Two rules keep the test honest, and both come from real lists rather than theory:
 *
 *  - No distractor from the same word. Another sense of the word being asked about would be a
 *    second correct answer.
 *  - No distractor that reads the same as the answer. Different words genuinely share a
 *    definition -- amiable and amicable are both "friendly" -- and offering one as a wrong
 *    answer marks a correct answer wrong.
 *
 * At most one option per word as well: a second sense of some other word is not incorrect, it
 * just spends an option on a word already ruled out.
 *
 * Distractors are drawn from the whole vocabulary even when only a slice of it is being asked
 * about, so a short run is not four options deep.
 *
 * `random` is injected so the shuffle can be asserted rather than hoped at.
 */
export function buildQuestions(meanings: MeaningRef[], options: BuildOptions = {}): BuiltQuestion[] {
  const { limit, random = Math.random } = options;

  const order = shuffle(meanings, random);
  const asked = limit === undefined ? order : order.slice(0, Math.max(0, limit));

  return asked.map((meaning, index) => {
    const pool = meanings.filter((m) => m.wordId !== meaning.wordId);

    const distractors: MeaningRef[] = [];
    const usedWords = new Set<string>([meaning.wordId]);
    const usedTexts = new Set<string>([normalise(meaning.text)]);

    for (const candidate of shuffle(pool, random)) {
      if (distractors.length >= OPTIONS_PER_QUESTION - 1) break;
      if (usedWords.has(candidate.wordId)) continue;
      const text = normalise(candidate.text);
      if (usedTexts.has(text)) continue;
      usedWords.add(candidate.wordId);
      usedTexts.add(text);
      distractors.push(candidate);
    }

    const optionIds = shuffle([meaning, ...distractors], random).map((m) => m.id);
    return { meaningId: meaning.id, position: index, optionIds };
  });
}

/** Fisher-Yates, on a copy. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
