// Importing TV shows from TMDB. What decides whether it can be trusted: seasons are read right
// (specials left out, runtimes and aired episodes worked out from the episodes themselves), a show
// lands on the series it should, and importing again never touches what you have watched — it only
// adds seasons, raises episode counts and fills blanks.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-tmdb-tv.mjs
import {
  toShow, seasonNumbersOf, toShowDetails, seasonTitle, placeSeries, planSeasons, tvWatchedMinutes, FALLBACK_RUNTIME,
} from "../lib/tmdb-tv.ts";
import { formatTotalTime } from "../lib/reading-time.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

// ── reading TMDB ─────────────────────────────────────────────────────────────
eq(toShow({ id: 1396, name: "Breaking Bad", first_air_date: "2008-01-20", poster_path: "/bb.jpg" }),
  { id: 1396, name: "Breaking Bad", year: 2008, released: "2008-01-20", poster: "https://image.tmdb.org/t/p/w92/bb.jpg" }, "a list row");
eq(toShow({ id: 1, name: " " }), null, "no name, no show");
eq(toShow({ id: -4, name: "X" }), null, "a junk id, no show");

eq(seasonNumbersOf({ seasons: [{ season_number: 2 }, { season_number: 0 }, { season_number: 1 }, { season_number: 2 }, { season_number: "x" }] }),
  [1, 2], "numbered seasons, in order, once each — specials (0) and junk left out");
eq(seasonNumbersOf({}), [], "no seasons listed, none fetched");

const ep = (air_date, runtime) => ({ air_date, runtime });
const today = "2026-10-02";
const raw = {
  id: 1396, name: "Breaking Bad", first_air_date: "2008-01-20", original_language: "en", poster_path: "/bb.jpg",
  created_by: [{ name: "Vince Gilligan" }, { name: "Vince Gilligan" }], networks: [{ name: "AMC" }, { name: "Other" }],
  episode_run_time: [], external_ids: { imdb_id: "tt0903747" },
  seasons: [
    { season_number: 0, episode_count: 9, air_date: "2009-02-17", poster_path: "/s0.jpg" },
    { season_number: 1, episode_count: 7, air_date: "2008-01-20", poster_path: "/s1.jpg" },
    { season_number: 2, episode_count: 3, air_date: "2026-09-01", poster_path: null },
    { season_number: 3, episode_count: 0, air_date: null, poster_path: null },
  ],
};
const answers = {
  1: { episodes: [ep("2008-01-20", 58), ep("2008-01-27", 48), ep("2008-02-10", 48), ep("2008-02-17", 48), ep("2008-02-24", 48), ep("2008-03-02", 48), ep("2008-03-09", 47)] },
  2: { episodes: [ep("2026-09-01", 50), ep("2026-10-02", null), ep("2026-10-09", null)] },
  3: { episodes: [] },
};
const bb = toShowDetails(raw, answers, today);
eq([bb.id, bb.name, bb.year, bb.creator, bb.network, bb.language, bb.imdbId, bb.poster],
  [1396, "Breaking Bad", 2008, "Vince Gilligan", "AMC", "ENGLISH", "tt0903747", "https://image.tmdb.org/t/p/w500/bb.jpg"],
  "show fields: creators once each, the first network, the IMDb id from external_ids");
eq(bb.seasons.map((s) => s.number), [1, 2, 3], "specials are not a season to import");
eq(bb.seasons[0], { number: 1, episodeCount: 7, airedCount: 7, runtime: 49, year: 2008, poster: "https://image.tmdb.org/t/p/w500/s1.jpg" },
  "a finished season: every episode aired, runtime the average of its episodes (345/7 → 49)");
eq([bb.seasons[1].episodeCount, bb.seasons[1].airedCount, bb.seasons[1].runtime], [3, 2, 50],
  "an airing season: an episode dated today has aired, next week's has not; runtimes TMDB lacks are left out of the average");
eq([bb.seasons[2].episodeCount, bb.seasons[2].airedCount, bb.seasons[2].runtime, bb.seasons[2].year], [null, 0, null, null],
  "an announced season with no episodes: unknown count (never 'complete'), nothing aired, no runtime of its own");
eq(bb.runtime, 49, "the show's typical runtime comes from all its episodes (393/8)");
const noEpisodes = toShowDetails({ ...raw, episode_run_time: [30, 32] }, {}, today);
eq(noEpisodes.runtime, 31, "no episode runtimes → the show's listed runtime");
eq(noEpisodes.seasons[0].episodeCount, 7, "no episode list → the season's own episode count");
eq(noEpisodes.seasons[0].airedCount, 0, "…and with no dates, nothing counts as aired");
eq(toShowDetails({ ...raw, episode_run_time: [] }, {}, today).runtime, FALLBACK_RUNTIME, "nothing at all → the column default");
eq(toShowDetails({ ...raw, external_ids: { imdb_id: "javascript:x" } }, {}, today).imdbId, null, "only a real IMDb id is kept");
eq(toShowDetails({ id: 5, name: "" }, {}, today), null, "no name, no show");
eq(seasonTitle("Breaking Bad", 3), "Breaking Bad | Season 3", "seasons are titled like the Add Season form titles them");

// ── where a show lands ───────────────────────────────────────────────────────
const series = (id, name, extra = {}) => ({ id, name, tmdbId: null, universeId: null, universeName: null, ...extra });
const show = { id: 1396, name: "Breaking Bad", year: 2008 };
eq(placeSeries(series("s1", "BB (mine)", { tmdbId: 1396, universeId: "u1", universeName: "Gilliganverse" }), [], show, "u1"),
  { action: "use", id: "s1", name: "BB (mine)", link: false, moveTo: null, outcome: "already" },
  "imported before, same universe: used as is, under your name for it");
eq(placeSeries(series("s1", "Breaking Bad", { tmdbId: 1396 }), [], show, "u1").moveTo, "u1", "a standalone series moves into the universe");
const elsewhere = placeSeries(series("s1", "Breaking Bad", { tmdbId: 1396, universeId: "u2", universeName: "Crime" }), [], show, "u1");
eq([elsewhere.outcome, elsewhere.where, elsewhere.moveTo], ["elsewhere", "Crime", null], "a series in another universe stays there");
eq(placeSeries(series("s1", "Breaking Bad", { tmdbId: 1396, universeId: "u2", universeName: "Crime" }), [], show, null).outcome,
  "elsewhere", "importing standalone never pulls a series out of its universe");
eq(placeSeries(null, [series("h", "breaking bad", { universeId: "u1" })], show, "u1"),
  { action: "use", id: "h", name: "breaking bad", link: true, moveTo: null, outcome: "linked" },
  "a series you made by hand with that name is linked");
eq(placeSeries(null, [], show, "u1"), { action: "create", name: "Breaking Bad", outcome: "added" }, "otherwise a new series");
const office = { id: 2316, name: "The Office", year: 2005 };
eq(placeSeries(null, [series("uk", "The Office", { tmdbId: 2996 })], office, null).name, "The Office (2005)",
  "a different show already holds the name: the start year tells them apart");
eq(placeSeries(null, [series("uk", "The Office", { tmdbId: 2996 }), series("x", "The Office (2005)", { tmdbId: 9 })], office, null).name,
  "The Office (TMDB 2316)", "…and if that is taken too, the TMDB id");
eq(placeSeries(null, [series("uk", "The Office", { tmdbId: 2996 })], { ...office, year: null }, null).name,
  "The Office (TMDB 2316)", "no year to tell them apart: the TMDB id");

// ── merging seasons ──────────────────────────────────────────────────────────
const row0 = (id, n) => ({ id, seasonNumber: n, totalEpisodes: null, episodesWatched: 0, year: null, coverImage: null, creator: null, network: null });
const fresh = planSeasons([], bb, { seriesName: "Breaking Bad", watched: false });
eq(fresh.added, [1, 2, 3], "a new series gets every season");
eq(fresh.create[0], {
  title: "Breaking Bad | Season 1", seasonNumber: 1, totalEpisodes: 7, episodesWatched: 0, episodeRuntime: 49, year: 2008,
  language: "ENGLISH", coverImage: "https://image.tmdb.org/t/p/w500/s1.jpg", creator: "Vince Gilligan", network: "AMC",
  status: "PLAN_TO_WATCH",
}, "…each with its episodes, runtime, year and poster, nothing watched");
eq([fresh.create[2].episodeRuntime, fresh.create[2].coverImage],
  [49, "https://image.tmdb.org/t/p/w500/bb.jpg"], "a season with none of its own takes the show's runtime and poster");
eq(fresh.create[2].year, null, "…but not its start year: a later season's year stays blank until TMDB dates it");
const dated = planSeasons([row0("r3", 3)], { ...bb, seasons: [{ ...bb.seasons[2], year: 2027, episodeCount: 8 }] }, { seriesName: "BB", watched: false });
eq(dated.update[0].data.year, 2027, "…and the import after it is dated fills it in");

const seen = planSeasons([], bb, { seriesName: "Breaking Bad", watched: true });
eq(seen.create.map((s) => [s.episodesWatched, s.status]), [[7, "COMPLETED"], [2, "WATCHING"], [0, "PLAN_TO_WATCH"]],
  "imported as watched: aired episodes only — a finished season is Completed, an airing one Watching, an announced one untouched");

const row = (id, n, extra = {}) => ({
  id, seasonNumber: n, totalEpisodes: null, episodesWatched: 0, year: null, coverImage: null, creator: null, network: null, ...extra,
});
const mine = [
  row("r1", 1, { totalEpisodes: 7, episodesWatched: 7, year: 2008, coverImage: "https://x.supabase.co/storage/v1/object/public/covers/a.jpg", creator: "Me", network: "Mine" }),
  row("r2", 2, { totalEpisodes: 2, episodesWatched: 2, year: 2026, coverImage: "https://img/2.jpg", creator: "Me", network: "Mine" }),
  row("loose", null, { totalEpisodes: 99 }),
];
const again = planSeasons(mine, bb, { seriesName: "Breaking Bad", watched: true });
eq(again.added, [3], "importing again only adds the missing season");
eq(again.update, [{ id: "r2", data: { totalEpisodes: 3, status: "WATCHING" } }],
  "an airing season gains its new episode — and is Watching again, 2 of 3 — with your 2 watched kept");
ok(!again.update.some((u) => u.id === "r1"), "a complete season with nothing blank is not touched at all");
ok(!again.update.some((u) => u.id === "loose"), "a season with no number is never matched");
const lower = planSeasons([row("r1", 1, { totalEpisodes: 10, episodesWatched: 3 })], bb, { seriesName: "BB", watched: false });
ok(!lower.update.some((u) => "totalEpisodes" in u.data), "an episode count is never lowered");
const blanks = planSeasons([row("r1", 1, { totalEpisodes: 7 })], bb, { seriesName: "BB", watched: false });
eq(blanks.update, [{ id: "r1", data: {
  year: 2008, coverImage: "https://image.tmdb.org/t/p/w500/s1.jpg", creator: "Vince Gilligan", network: "AMC",
} }], "blanks are filled");
ok([...again.update, ...blanks.update].every((u) => Object.keys(u.data).every((k) =>
  ["totalEpisodes", "status", "year", "coverImage", "creator", "network"].includes(k))),
  "an import can never write episodes watched, title, runtime, rating, rewatches, notes or language onto a season you have");
eq(planSeasons([row("r1", 1), row("dup", 1, { totalEpisodes: 1 })], bb, { seriesName: "BB", watched: false }).update.map((u) => u.id),
  ["r1"], "two rows with one number: only the first is ever touched");

// ── time watched ─────────────────────────────────────────────────────────────
eq(tvWatchedMinutes([
  { episodesWatched: 7, episodeRuntime: 49, timesRewatched: 0 },
  { episodesWatched: 2, episodeRuntime: 50, timesRewatched: 1 },
  { episodesWatched: 0, episodeRuntime: 60, timesRewatched: 3 },
]), 7 * 49 + 2 * 50 * 2, "every episode watched × its runtime, once more per rewatch");
eq(tvWatchedMinutes([]), 0, "nothing watched, no time");
eq(formatTotalTime(0), "—", "no time shows a dash");
eq(formatTotalTime(200), "3h 20m", "under a day: hours and minutes");
eq(formatTotalTime(6150), "4d 6h · 103h", "past a day: days and hours, with the plain hour count beside");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
