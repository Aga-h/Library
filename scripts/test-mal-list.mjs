// Importing a whole MyAnimeList list. What decides whether it can be trusted: a list is read the
// same from any of its three sources, only complete TV/web seasons go in (films, OVAs, specials,
// recaps, shorts and anything unfinished are left out, with the reason), a title-only line is
// matched to the right entry, and seasons are grouped into series along sequel links only.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-mal-list.mjs
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { readFirstSheet, gunzip, decodeXml } from "../lib/xlsx-lite.ts";
import {
  rowsFromSheet, rowsFromMalXml, rowsFromApiList, malIdFromLink, mediaTypeOf, leftOutByList, leftOutByEntry,
  pickMatch, searchQuery, groupSeries, bridgeIds,
} from "../lib/mal-list.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
async function throws(fn, pattern, label) {
  try { await fn(); failures.push(`${label} — did not throw`); }
  catch (e) { if (pattern.test(String(e.message))) pass++; else failures.push(`${label} — threw "${e.message}"`); }
}

// ── reading a spreadsheet copy of a list page ────────────────────────────────
const sheet = await readFirstSheet(new Uint8Array(await readFile(new URL("./fixtures/mal-list.xlsx", import.meta.url))));
eq(sheet[3][3].link, "https://myanimelist.net/anime/16498/Shingeki_no_Kyojin", "a cell's hyperlink is read");
const rows = rowsFromSheet(sheet);
eq(rows.map((r) => [r.key, r.title, r.malId, r.mediaType, r.episodes, r.watched]), [
  ["16498", "Attack on Titan", 16498, "tv", 25, 25],
  ["28851", "A Silent Voice", 28851, "movie", 1, 1],
  ["99", "Akame ga Kill! Recap", 99, "tv_special", 1, 1],
  ["row 7", "Fish & Chips <Season>", null, "ona", 12, 12],
], "rows: header found, \"Add - More\" stripped, id from the link, a line without a link keyed by row, a repeat dropped");
await throws(() => readFirstSheet(new TextEncoder().encode("not a zip")), /isn't an \.xlsx/, "a file that is not an xlsx");
await throws(async () => rowsFromSheet([[{ text: "hello", link: null }]]), /No list/, "a sheet without a list header");
eq(decodeXml("Fish &amp; Chips &#x3A9; &#937; &lt;"), "Fish & Chips Ω Ω <", "XML entities");

eq(malIdFromLink("https://myanimelist.net/anime/5114/Fullmetal"), 5114, "an id from an anime link");
eq(malIdFromLink("https://myanimelist.net/manga/5114/x"), null, "a manga link is not an anime");
eq(malIdFromLink("https://evil.example/anime/5114"), null, "another site's link is ignored");
eq(malIdFromLink("https://myanimelist.net/animelist/someone?status=2"), null, "a list link is no anime");
eq([mediaTypeOf("TV Special"), mediaTypeOf(" ONA "), mediaTypeOf("Unknown"), mediaTypeOf("")], ["tv_special", "ona", "unknown", "unknown"], "media types");

// ── MyAnimeList's export, gzipped as it is downloaded ────────────────────────
const xml = `<?xml version="1.0"?><myanimelist><myinfo><user_name>x</user_name></myinfo>
<anime><series_animedb_id>5114</series_animedb_id><series_title><![CDATA[Fullmetal Alchemist: Brotherhood]]></series_title>
<series_type>TV</series_type><series_episodes>64</series_episodes><my_watched_episodes>64</my_watched_episodes><my_status>Completed</my_status></anime>
<anime><series_animedb_id>1</series_animedb_id><series_title>Cowboy Bebop</series_title><series_type>TV</series_type>
<series_episodes>26</series_episodes><my_watched_episodes>3</my_watched_episodes><my_status>Watching</my_status></anime>
</myanimelist>`;
const fromXml = rowsFromMalXml(new TextDecoder().decode(await gunzip(new Uint8Array(gzipSync(xml)))));
eq(fromXml.map((r) => [r.malId, r.title, r.mediaType, r.episodes, r.watched, r.status]),
  [[5114, "Fullmetal Alchemist: Brotherhood", "tv", 64, 64, "completed"], [1, "Cowboy Bebop", "tv", 26, 3, "watching"]],
  "the export: CDATA titles, status, counts (through gunzip)");
await throws(async () => rowsFromMalXml("<html></html>"), /isn't a MyAnimeList export/, "not an export");

// ── the API's list ───────────────────────────────────────────────────────────
eq(rowsFromApiList({ data: [
  { node: { id: 16498, title: "Shingeki no Kyojin", alternative_titles: { en: "Attack on Titan" }, media_type: "tv", num_episodes: 25 },
    list_status: { status: "completed", num_episodes_watched: 25 } },
  { node: { id: 2, title: "No English", media_type: "movie", num_episodes: 0 }, list_status: { status: "completed" } },
  { node: { title: "no id" } },
] }).map((r) => [r.malId, r.title, r.mediaType, r.episodes, r.watched, r.status]),
  [[16498, "Attack on Titan", "tv", 25, 25, "completed"], [2, "No English", "movie", null, null, "completed"]],
  "the API list: English title preferred, unknown counts unknown, a line without an id dropped");

// ── which lines are complete seasons ─────────────────────────────────────────
const line = (over) => ({ key: "k", title: "Show", malId: 1, mediaType: "tv", episodes: 12, watched: 12, status: null, ...over });
eq([
  leftOutByList(line({})),
  leftOutByList(line({ mediaType: "ona" })),
  leftOutByList(line({ mediaType: "unknown", episodes: null, watched: null })),
  leftOutByList(line({ mediaType: "movie", episodes: 1 })),
  leftOutByList(line({ mediaType: "ova" })),
  leftOutByList(line({ mediaType: "special" })),
  leftOutByList(line({ mediaType: "tv_special" })),
  leftOutByList(line({ mediaType: "cm" })),
  leftOutByList(line({ title: "Akame ga Kill! Recap" })),
  leftOutByList(line({ mediaType: "ona", episodes: 1, watched: 1 })),
  leftOutByList(line({ watched: 5 })),
  leftOutByList(line({ status: "watching" })),
  leftOutByList(line({ status: "completed" })),
], [null, null, null, "a film", "an OVA", "a special", "a TV special", "an ad", "a recap", "a single episode",
  "not finished (5 of 12)", "not on your Completed list", null], "left out by the list alone");

const entry = (over) => ({
  id: 1, title: "Show", titleEn: null, synonyms: [], year: 2020, startDate: "2020-01-01", season: null, mediaType: "tv",
  airing: "finished", episodes: 12, duration: 24, studio: null, poster: null, sequels: [], prequels: [], ...over,
});
eq([
  leftOutByEntry(entry({}), line({})),
  leftOutByEntry(entry({ episodes: 24, duration: 2 }), line({ episodes: 24, watched: 24 })),
  leftOutByEntry(entry({ episodes: 120, duration: 4 }), line({ episodes: 120, watched: 120 })),
  leftOutByEntry(entry({ episodes: 12, duration: null }), line({})),
  leftOutByEntry(entry({ airing: "airing", episodes: null }), line({})),
  leftOutByEntry(entry({ mediaType: "movie", episodes: 1 }), line({})),
  leftOutByEntry(entry({ titleEn: "Show: Recap" }), line({})),
  leftOutByEntry(entry({ episodes: 13 }), line({ watched: 12 })),
  leftOutByEntry(entry({}), null),
], [null, "shorts (24 × 2 min)", null, null, "still airing", "a film", "a recap", "not finished (12 of 13)", null],
  "left out by MyAnimeList's details: shorts under an hour in all, but a long run of short episodes is a season");

// ── finding a line without an id ─────────────────────────────────────────────
const fc = line({ title: "Fish & Chips", malId: null, mediaType: "ona", episodes: 12 });
const tvFc = entry({ id: 10, title: "Fish and Chips", mediaType: "tv", episodes: 12 });
const onaFc = entry({ id: 11, title: "Sakana", titleEn: "Fish & Chips", mediaType: "ona", episodes: 12 });
const other = entry({ id: 12, title: "Other", mediaType: "ona", episodes: 12 });
eq(pickMatch(fc, [tvFc, onaFc, other]), { entry: onaFc, guessed: false }, "same title, same type and count wins");
eq(pickMatch(fc, [tvFc, other]), { entry: tvFc, guessed: false }, "same title, other type: still the title");
eq(pickMatch(fc, [other]), { entry: other, guessed: true }, "no title match: same type and count, marked a guess");
eq(pickMatch(line({ ...fc, episodes: 5 }), [other]), null, "nothing fits");
eq(searchQuery("  short  "), "short", "a short query is kept");
const long = searchQuery("Drug Store in Another World: The Slow Life of a Cheat Pharmacist and a lot more words");
eq([long.length <= 60, long.endsWith(" ")], [true, false], "a long title is cut at a word");

// ── grouping into series ─────────────────────────────────────────────────────
const s1 = entry({ id: 1, startDate: "2013-04-07", sequels: [2] });
const s2 = entry({ id: 2, startDate: "2017-04-01", prequels: [1], sequels: [90] });
const film = entry({ id: 90, mediaType: "movie", startDate: "2018-01-01", prequels: [2], sequels: [3] });
const s3 = entry({ id: 3, startDate: "2019-04-01", prequels: [90] });
const alone = entry({ id: 7, startDate: "2010-01-01" });
const spinoff = entry({ id: 8, startDate: "2014-01-01", sequels: [] });
eq(bridgeIds([s1, s2, s3], new Set([1, 2, 3])), [90], "links out of the set are the bridges to fetch");
eq(groupSeries([s3, s1, s2, alone, spinoff], [film]).map((g) => g.map((e) => e.id)), [[7], [1, 2, 3], [8]],
  "a film between seasons joins them; series in watch order, by their first season");
eq(groupSeries([s1, s3], [film]).map((g) => g.map((e) => e.id)), [[1], [3]],
  "two bridges in a row are not followed — a missing season splits the series");
eq(groupSeries([s1, s1, s2], []).map((g) => g.map((e) => e.id)), [[1, 2]], "a season twice is there once");

if (failures.length) {
  console.error(`✗ ${failures.length} failed, ${pass} passed\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ mal-list: ${pass} assertions passed`);
