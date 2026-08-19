// Exhaustive check of the status-derivation rule. Pure logic, so it earns real coverage:
// this is the thing that decides what every item in the library is labelled.
//
// Run: node --experimental-strip-types scripts/test-derive-status.mjs
import {
  deriveStatus, bookProgress, animeProgress, tvProgress, mangaProgress,
  BOOK_STATUS, WATCH_STATUS, READ_STATUS,
} from "../lib/derive-status.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  if (actual === expected) pass++;
  else failures.push(`${label}\n    expected ${expected}, got ${actual}`);
}

// ── the core table, across every vocabulary ──────────────────────────────────
const vocabs = [
  ["book", BOOK_STATUS], ["watch", WATCH_STATUS], ["read", READ_STATUS],
];
const totals = [null, undefined, 0, 1, 24];
const progresses = [0, 1, 12, 23, 24, 25, -3];

for (const [name, v] of vocabs) {
  for (const total of totals) {
    for (const progress of progresses) {
      const got = deriveStatus({ progress, total }, v);
      const hasTotal = total != null && total > 0;
      const done = progress > 0 ? progress : 0;
      const want = hasTotal && done >= total ? v.completed : done > 0 ? v.inProgress : v.planned;
      eq(got, want, `${name} progress=${progress} total=${String(total)}`);
    }
  }
}

// ── the rules that actually matter, spelled out ──────────────────────────────
eq(deriveStatus({ progress: 24, total: 24 }, WATCH_STATUS), "COMPLETED", "all watched → completed");
eq(deriveStatus({ progress: 5, total: 24 }, WATCH_STATUS), "WATCHING", "some watched → watching");
eq(deriveStatus({ progress: 0, total: 24 }, WATCH_STATUS), "PLAN_TO_WATCH", "none watched → plan");
eq(deriveStatus({ progress: 30, total: 24 }, WATCH_STATUS), "COMPLETED", "over-watched → completed");
eq(deriveStatus({ progress: 500, total: null }, READ_STATUS), "READING", "unknown total never completes");
eq(deriveStatus({ progress: 0, total: null }, READ_STATUS), "PLAN_TO_READ", "unknown total, nothing read");
eq(deriveStatus({ progress: -5, total: 24 }, WATCH_STATUS), "PLAN_TO_WATCH", "negative treated as zero");
eq(deriveStatus({ progress: 0, total: 0 }, BOOK_STATUS), "WANT_TO_READ", "zero total, nothing read");
eq(deriveStatus({ progress: 3, total: 0 }, BOOK_STATUS), "READING", "zero total but progress → reading");

// ── per-entity field selection ───────────────────────────────────────────────
eq(deriveStatus(bookProgress({ pagesRead: 320, pages: 320 }), BOOK_STATUS), "READ", "book finished");
eq(deriveStatus(bookProgress({ pagesRead: 0, pages: 320 }), BOOK_STATUS), "WANT_TO_READ", "book unstarted");
eq(deriveStatus(bookProgress({ pages: 320 }), BOOK_STATUS), "WANT_TO_READ", "book missing pagesRead");
eq(deriveStatus(animeProgress({ episodesWatched: 12, episodes: 12 }), WATCH_STATUS), "COMPLETED", "anime finished");
eq(deriveStatus(animeProgress({ episodesWatched: 3, episodes: null }), WATCH_STATUS), "WATCHING", "anime unknown total");
eq(deriveStatus(tvProgress({ episodesWatched: 24, totalEpisodes: 24 }), WATCH_STATUS), "COMPLETED", "tv finished");

// ── manga precedence: chapters lead, volumes fall back, ongoing wins ─────────
eq(deriveStatus(mangaProgress({ chaptersRead: 120, totalChapters: 120, volumesRead: 1, totalVolumes: 12 }), READ_STATUS),
   "COMPLETED", "manga chapters lead over volumes");
eq(deriveStatus(mangaProgress({ chaptersRead: 90, totalChapters: 120, volumesRead: 12, totalVolumes: 12 }), READ_STATUS),
   "READING", "manga stale volume count does not complete it");
eq(deriveStatus(mangaProgress({ volumesRead: 12, totalVolumes: 12 }), READ_STATUS),
   "COMPLETED", "manga falls back to volumes when chapters absent");
eq(deriveStatus(mangaProgress({ chaptersRead: 40 }), READ_STATUS),
   "READING", "manga with no totals at all");
eq(deriveStatus(mangaProgress({ chaptersRead: 500, totalChapters: 500, ongoing: true }), READ_STATUS),
   "READING", "ongoing manga never completes even at full count");
eq(deriveStatus(mangaProgress({ chaptersRead: 0, ongoing: true }), READ_STATUS),
   "PLAN_TO_READ", "ongoing manga, nothing read");
eq(deriveStatus(mangaProgress({ volumesRead: 3, ongoing: true }), READ_STATUS),
   "READING", "ongoing manga tracked by volume");

console.log(`${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n  " + failures.join("\n  "));
  process.exit(1);
}
