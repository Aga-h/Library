// Importing anime from MyAnimeList. What decides whether it can be trusted: entries are read
// defensively (only MAL's own image CDN, durations from seconds, unknown counts left unknown), a run
// lands as one series in watch order, and importing again never touches what you have watched — it
// adds entries, raises episode counts and fills blanks only.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-mal.mjs
import {
  toEntry, malImage, isMalImage, startDateOf, titleFor, byAiring, matchEntries, chooseSeries, planEntries,
  animeWatchedMinutes, FALLBACK_DURATION, UNTICKED_MEDIA,
} from "../lib/mal.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

// ── reading MyAnimeList ──────────────────────────────────────────────────────
const aot = toEntry({
  id: 16498, title: "Shingeki no Kyojin",
  main_picture: { medium: "https://cdn.myanimelist.net/images/anime/10/47347.jpg", large: "https://cdn.myanimelist.net/images/anime/10/47347l.jpg" },
  alternative_titles: { synonyms: ["AoT", " "], en: "Attack on Titan", ja: "進撃の巨人" },
  start_date: "2013-04-07", start_season: { year: 2013, season: "spring" }, media_type: "tv", status: "finished_airing",
  num_episodes: 25, average_episode_duration: 1440, studios: [{ name: "Wit Studio" }, { name: "Production I.G" }],
  related_anime: [
    { node: { id: 25777 }, relation_type: "sequel" }, { node: { id: 18397 }, relation_type: "side_story" },
    { node: { id: 25777 }, relation_type: "sequel" }, { node: { id: 1 }, relation_type: "prequel" },
  ],
});
eq(aot, {
  id: 16498, title: "Shingeki no Kyojin", titleEn: "Attack on Titan", synonyms: ["AoT"], year: 2013, startDate: "2013-04-07",
  season: "SPRING", mediaType: "tv", airing: "finished", episodes: 25, duration: 24, studio: "Wit Studio",
  poster: "https://cdn.myanimelist.net/images/anime/10/47347l.jpg", sequels: [25777], prequels: [1],
}, "a full entry: English title, airing season, minutes from seconds, the lead studio, links by kind (side stories are not links)");
const upcoming = toEntry({ id: 9, title: "Next", num_episodes: 0, average_episode_duration: 0, status: "not_yet_aired", start_date: "2027" });
eq([upcoming.episodes, upcoming.duration, upcoming.airing, upcoming.year, upcoming.season, upcoming.poster],
  [null, null, "upcoming", 2027, null, null], "not aired yet: unknown episodes and length stay unknown, the year from a bare date");
eq(toEntry({ id: 9, title: "X", alternative_titles: { en: "X" } }).titleEn, null, "an English title that is the same is no English title");
eq(toEntry({ id: 9, title: " " }), null, "no title, no entry");
eq(toEntry({ id: 0, title: "X" }), null, "a junk id, no entry");
eq(malImage("https://cdn.myanimelist.net/images/anime/1/1.jpg"), "https://cdn.myanimelist.net/images/anime/1/1.jpg", "MAL's CDN is kept");
for (const bad of ["http://cdn.myanimelist.net/a.jpg", "https://cdn.myanimelist.net.evil.io/a.jpg", "javascript:alert(1)", "", null, 7]) {
  eq(malImage(bad), null, `${JSON.stringify(bad)} is not a MAL image`);
}
ok(isMalImage("https://cdn.myanimelist.net/images/anime/1/1.jpg") && !isMalImage("https://image.tmdb.org/t/p/w500/a.jpg") && !isMalImage(null),
  "MAL posters are told apart from everything else");
eq(["2013-04-07", "2013-04", "2013", "13-04-07", "1800", "", null].map(startDateOf), ["2013-04-07", "2013-04", "2013", null, null, null, null],
  "start dates at any precision MAL has");
eq([titleFor(aot, true), titleFor(aot, false), titleFor({ title: "Mushishi", titleEn: null }, true)],
  ["Attack on Titan", "Shingeki no Kyojin", "Mushishi"], "English when asked for and there is one, else MAL's own title");
ok(UNTICKED_MEDIA.has("music") && !UNTICKED_MEDIA.has("movie"), "music videos start unticked, films don't");

const e = (id, startDate, extra = {}) => ({
  id, title: `Entry ${id}`, titleEn: null, synonyms: [], year: startDate ? Number(startDate.slice(0, 4)) : null, startDate,
  season: null, mediaType: "tv", airing: "finished", episodes: 12, duration: 24, studio: "Studio", poster: `https://cdn.myanimelist.net/${id}.jpg`,
  sequels: [], prequels: [], ...extra,
});
eq([e(3, null), e(2, "2019-04-29"), e(1, "2019"), e(4, "2013-04-07"), e(5, "2019-04-29")].sort(byAiring).map((x) => x.id),
  [4, 1, 2, 5, 3], "watch order: by start date, a bare year first within its year, ties by id, undated last");

// ── matching what you have ───────────────────────────────────────────────────
const row = (id, extra = {}) => ({
  id, title: "T", year: null, malId: null, studio: null, episodes: null, episodesWatched: 0, season: null, coverImage: null,
  seasonNumber: null, seriesId: null, seriesName: null, seriesUniverseId: null, seriesUniverseName: null, ...extra,
});
const aot1 = e(16498, "2013-04-07", { title: "Shingeki no Kyojin", titleEn: "Attack on Titan", synonyms: ["AoT"] });
const aot2 = e(25777, "2017-04-01", { title: "Shingeki no Kyojin Season 2", titleEn: "Attack on Titan Season 2" });
const m = matchEntries([
  row("byId", { malId: 25777, title: "renamed by me" }),
  row("hand", { title: "attack on titan!", year: 2013 }),
  row("other", { title: "Attack on Titan", year: 2099 }),
], [aot1, aot2]);
eq([m.get(16498)?.id, m.get(25777)?.id], ["hand", "byId"],
  "matched by MAL id, else by any of its titles with the same year — a different year is a different entry");
const once = matchEntries([row("h", { title: "AoT" })], [aot1, e(1, "2013", { title: "AoT" })]);
eq([once.get(16498)?.id, once.get(1)], ["h", undefined], "a row you added by hand is claimed once");

// ── which series ─────────────────────────────────────────────────────────────
const run = { name: "Attack on Titan", year: 2013, firstId: 16498, count: 2 };
eq(chooseSeries(new Map(), [], run, "u1"), { action: "create", name: "Attack on Titan" }, "a new run, a new series");
eq(chooseSeries(new Map(), [], { ...run, count: 1 }, null), { action: "none" }, "one entry on its own stays a single anime");
eq(chooseSeries(new Map(), [], { ...run, count: 1 }, "u1").action, "create", "…but inside a universe it needs a series to live in");
eq(chooseSeries(new Map(), [{ id: "s", name: "attack on titan", fromMal: false }], run, "u1"),
  { action: "use", id: "s", name: "attack on titan", moveTo: null, outcome: "linked" }, "a series you made with that name is used");
eq(chooseSeries(new Map(), [{ id: "x", name: "Attack on Titan", fromMal: false }], { ...run, name: "Attack on Titan" }, null).action,
  "use", "…standalone too");
const inSeries = (seriesId, uni, uniName) => row("r" + seriesId, { seriesId, seriesName: `Series ${seriesId}`, seriesUniverseId: uni, seriesUniverseName: uniName });
eq(chooseSeries(new Map([[1, inSeries("A", "u1")], [2, inSeries("B", "u1")], [3, inSeries("B", "u1")]]), [], run, "u1"),
  { action: "use", id: "B", name: "Series B", moveTo: null, outcome: "already" }, "entries already in a series: the one holding most of them");
eq(chooseSeries(new Map([[1, inSeries("A", null)]]), [], run, "u1").moveTo, "u1", "a standalone series moves into the universe");
const away = chooseSeries(new Map([[1, inSeries("A", "u2", "Shonen")]]), [], run, "u1");
eq([away.outcome, away.where, away.moveTo], ["elsewhere", "Shonen", null], "a series in another universe stays there");
eq(chooseSeries(new Map([[1, row("solo")]]), [], { ...run, count: 1 }, null), { action: "none" },
  "a single entry you already have standalone stays standalone");
const hxh = { name: "Hunter x Hunter", year: 1999, firstId: 136, count: 1 };
eq(chooseSeries(new Map(), [{ id: "t", name: "Hunter x Hunter", fromMal: true }], hxh, "u1"), { action: "create", name: "Hunter x Hunter (1999)" },
  "a same-named series holding another run (the 2011 one) is not yours by hand: a new series, told apart by year");
eq(chooseSeries(new Map(), [{ id: "t", name: "Hunter x Hunter", fromMal: true }, { id: "u", name: "Hunter x Hunter (1999)", fromMal: true }], hxh, "u1"),
  { action: "create", name: "Hunter x Hunter (MAL 136)" }, "…and by MAL id when the year is taken too");

// ── merging entries ──────────────────────────────────────────────────────────
const fresh = planEntries([aot2, aot1], new Map(), { id: "S", highestSeason: 0 }, { watched: false, english: true });
eq(fresh.create.map((c) => [c.title, c.seasonNumber, c.malId]), [["Attack on Titan", 1, 16498], ["Attack on Titan Season 2", 2, 25777]],
  "a new series: every entry, in watch order, numbered, under the chosen title");
eq(fresh.create[0], {
  title: "Attack on Titan", malId: 16498, studio: "Studio", episodes: 12, episodesWatched: 0, episodeDuration: 24, season: null,
  year: 2013, language: "JAPANESE", coverImage: "https://cdn.myanimelist.net/16498.jpg", seasonNumber: 1, status: "PLAN_TO_WATCH",
}, "…with its episodes, length, studio, year and poster");
eq(planEntries([aot1], new Map(), { id: "S", highestSeason: 0 }, { watched: false, english: false }).create[0].title,
  "Shingeki no Kyojin", "MAL's own title when asked for");
const airing = e(7, "2026-07-01", { airing: "airing", episodes: 24 });
const unknownLen = e(8, "2026-10-01", { airing: "upcoming", episodes: null, duration: null });
const seen = planEntries([aot1, airing, unknownLen], new Map(), { id: "S", highestSeason: 0 }, { watched: true, english: true });
eq(seen.create.map((c) => [c.episodesWatched, c.status, c.episodeDuration]), [[12, "COMPLETED", 24], [0, "PLAN_TO_WATCH", 24], [0, "PLAN_TO_WATCH", FALLBACK_DURATION]],
  "imported as watched: finished entries fully — an airing one stays at 0 (MAL has no episode dates); unknown length → 24");
eq(planEntries([aot1], new Map(), { id: null, highestSeason: 0 }, { watched: false, english: true }).create[0].seasonNumber, null,
  "a standalone anime has no season number");

const mine = new Map([
  [16498, row("a", { malId: 16498, title: "My AoT", seriesId: "S", episodes: 25, episodesWatched: 25, seasonNumber: 1, studio: "Mine", season: "SPRING", year: 2013, coverImage: "https://x/mine.jpg" })],
  [25777, row("b", { malId: 25777, title: "AoT 2", seriesId: "S", episodes: 10, episodesWatched: 10, seasonNumber: 2, year: 2017, coverImage: "https://x/2.jpg" })],
]);
const aot3 = e(35760, "2018-07-23");
const again = planEntries([aot1, aot2, aot3], mine, { id: "S", highestSeason: 2 }, { watched: true, english: true });
eq(again.create.map((c) => [c.malId, c.seasonNumber]), [[35760, 3]], "importing again only adds the new entry, as the next season");
eq(again.update, [{ id: "b", data: { studio: "Studio", episodes: 12, status: "WATCHING" } }],
  "an entry MAL now lists more episodes for gains them — 10 of 12 is Watching again — and a blank studio; nothing else");
ok(!again.update.some((u) => u.id === "a"), "a complete entry with nothing blank is not touched at all");
eq(again.report.map((r) => [r.title, r.outcome]), [["My AoT", "already"], ["AoT 2", "already"], ["Entry 35760", "added"]],
  "reported under the names you gave them");
const lower = planEntries([aot1], new Map([[16498, row("a", { malId: 16498, seriesId: "S", episodes: 30 })]]), { id: "S", highestSeason: 1 }, { watched: false, english: true });
ok(!lower.update.some((u) => "episodes" in u.data), "an episode count is never lowered");
ok([...again.update, ...lower.update].every((u) => Object.keys(u.data).every((k) =>
  ["malId", "studio", "episodes", "status", "season", "year", "coverImage", "seasonNumber", "seriesId"].includes(k))),
  "an import can never write title, episodes watched, length, rating, rewatches, notes or language onto an entry you have");

const moves = planEntries([aot1, aot2], new Map([
  [16498, row("loose", { title: "attack on titan", year: 2013 })],
  [25777, row("there", { malId: 25777, title: "S2", seriesId: "OTHER", seriesName: "My other series" })],
]), { id: "S", highestSeason: 4 }, { watched: false, english: true });
eq(moves.report.map((r) => [r.outcome, r.where ?? null]), [["moved", null], ["elsewhere", "My other series"]],
  "a standalone entry joins the series; one in another series stays there");
const looseData = moves.update.find((u) => u.id === "loose").data;
eq([looseData.malId, looseData.seriesId, looseData.seasonNumber], [16498, "S", 5], "…linked to MAL and numbered after the series' last season");
ok(!moves.update.some((u) => u.id === "there" && "seriesId" in u.data), "the other series' entry is never moved");
eq(planEntries([], new Map(), { id: "S", highestSeason: 0 }, { watched: false, english: true }), { create: [], update: [], report: [] },
  "an empty import changes nothing");

// ── time watched ─────────────────────────────────────────────────────────────
eq(animeWatchedMinutes([
  { episodesWatched: 25, episodeDuration: 24, timesRewatched: 0 },
  { episodesWatched: 12, episodeDuration: 23, timesRewatched: 1 },
]), 25 * 24 + 12 * 23 * 2, "every episode watched × its length, once more per rewatch");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
