// Comic Vine: the pure half of importing a run. What a Comic Vine issue number means here, which
// cover URL to keep, and how an import merges into a comic you may already have marked up.
//
// No network and no database, so all of it is tested directly. The fetching lives in
// lib/comicvine-service.ts.

export interface CvVolume {
  id: number;
  name: string;
  startYear: number | null;
  issueCount: number;
  publisher: string | null;
  image: string | null;
}

export interface CvIssue {
  id: number;
  /** As Comic Vine stores it: a string, because runs have issues like "½", "-1" and "1.MU". */
  issueNumber: string;
  name: string | null;
  image: string | null;
}

// ─── Issue numbers ───────────────────────────────────────────────────────────

/**
 * Comic Vine's issue number → the number this app sorts and stores by, or null when it is not a
 * plain number. "-1", "0", "½", "1.5" and "12" all have a place in the order; "1.MU" or "Annual 1"
 * do not, and are reported back rather than guessed at.
 */
export function parseIssueNumber(raw: string | null | undefined): number | null {
  const s = (raw ?? "").trim();
  if (s === "") return null;
  if (s === "½" || s === "1/2") return 0.5;
  const half = /^(-?\d+)\s*½$/.exec(s);
  if (half) return Number(half[1]) + (half[1].startsWith("-") ? -0.5 : 0.5);
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ─── Covers ──────────────────────────────────────────────────────────────────

/**
 * The cover URL to keep from a Comic Vine image object. The docs only say "main image", not what
 * is inside it, so this takes the first usable https URL in order of preference rather than
 * trusting one field name.
 */
export function pickImage(image: unknown): string | null {
  if (!image || typeof image !== "object") return null;
  const record = image as Record<string, unknown>;
  const preferred = ["medium_url", "small_url", "super_url", "screen_url", "original_url", "thumb_url"];
  const candidates = [...preferred.map((k) => record[k]), ...Object.values(record)];
  for (const value of candidates) {
    if (typeof value !== "string" || !value.startsWith("https://")) continue;
    // Comic Vine serves a generic placeholder for issues without art; a blank is better than that.
    // The filename usually leads with an id ("6373148-blank.png"), so match anywhere in it.
    if (/\/[^/]*(blank|no[-_]?image|questionmark)[^/]*\.(png|jpe?g|gif)$/i.test(value)) continue;
    return value;
  }
  return null;
}

/**
 * Covers hotlinked from Comic Vine. These are shown `unoptimized`: they are already sized, and
 * sending a few hundred of them per run through the image optimizer would spend its quota and
 * widen its host allowlist for nothing.
 */
export function isComicVineImage(src: string | null | undefined): boolean {
  if (!src) return false;
  try {
    const host = new URL(src).hostname;
    return host === "comicvine.gamespot.com" || host.endsWith(".comicvine.gamespot.com");
  } catch {
    return false;
  }
}

// ─── Naming and ranking ──────────────────────────────────────────────────────

/**
 * What an imported run is called here. Marvel reuses titles — there are six Amazing Spider-Man
 * runs — so the start year is part of the name, as readers write it: "The Amazing Spider-Man
 * (1963)". It also keeps two runs from colliding on the (universe, name) unique key.
 */
export function titleNameFor(volume: Pick<CvVolume, "name" | "startYear">): string {
  const name = volume.name.trim();
  return volume.startYear ? `${name} (${volume.startYear})` : name;
}

/** Search results with the current publisher's runs first, otherwise in Comic Vine's own order. */
export function rankVolumes(volumes: CvVolume[], publisherName: string | null): CvVolume[] {
  if (!publisherName) return volumes;
  const want = normalisePublisher(publisherName);
  const mine = volumes.filter((v) => v.publisher && normalisePublisher(v.publisher) === want);
  const rest = volumes.filter((v) => !mine.includes(v));
  return [...mine, ...rest];
}

/** "Marvel", "Marvel Comics" and "marvel" are the same publisher. */
function normalisePublisher(name: string): string {
  return name.toLowerCase().replace(/\b(comics?|publishing|entertainment|inc|llc)\b\.?/g, "").replace(/\s+/g, " ").trim();
}

// ─── Merging an import into what you already have ────────────────────────────

export interface ExistingIssue {
  id: string;
  issueNumber: number;
  name: string | null;
  coverImage: string | null;
}

export interface MergePlan {
  /** Issues the comic does not have yet. */
  create: { issueNumber: number; name: string | null; coverImage: string | null }[];
  /** Existing issues with a blank name or cover that Comic Vine can fill. Never anything else. */
  fill: { id: string; name?: string; coverImage?: string }[];
  /** Comic Vine issues that could not be placed, with why — reported, never silently dropped. */
  skipped: { issueNumber: string; reason: string }[];
}

/**
 * How an import lands on a comic that may already exist and be marked up.
 *
 * The one rule: an import only ever ADDS. New issues are created; an existing issue gets a name
 * or cover only where it has none. Read, owned, rating, rereads, notes — and any name or cover you
 * set yourself — are never touched, so importing a run again is always safe.
 */
export function planMerge(existing: ExistingIssue[], incoming: CvIssue[]): MergePlan {
  const byNumber = new Map(existing.map((issue) => [issue.issueNumber, issue]));
  const seen = new Map<number, string>();
  const plan: MergePlan = { create: [], fill: [], skipped: [] };

  for (const cv of incoming) {
    const number = parseIssueNumber(cv.issueNumber);
    if (number === null) {
      plan.skipped.push({ issueNumber: cv.issueNumber, reason: "not a plain issue number — add it by hand" });
      continue;
    }
    const earlier = seen.get(number);
    if (earlier !== undefined) {
      plan.skipped.push({ issueNumber: cv.issueNumber, reason: `same number as #${earlier}` });
      continue;
    }
    seen.set(number, cv.issueNumber);

    const name = cv.name?.trim() || null;
    const current = byNumber.get(number);
    if (!current) {
      plan.create.push({ issueNumber: number, name, coverImage: cv.image });
      continue;
    }
    const fill: MergePlan["fill"][number] = { id: current.id };
    if (!current.name && name) fill.name = name;
    if (!current.coverImage && cv.image) fill.coverImage = cv.image;
    if (fill.name !== undefined || fill.coverImage !== undefined) plan.fill.push(fill);
  }

  plan.create.sort((a, b) => a.issueNumber - b.issueNumber);
  return plan;
}
