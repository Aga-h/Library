// Importing a whole MyAnimeList list: reading the file it arrives in, telling seasons from films,
// OVAs, specials, recaps and shorts, and matching title-only rows to the right entry.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-mal-list.mjs
import { readFileSync } from "node:fs";
import { readFirstSheet, sheetRows, sharedStrings, decodeXml } from "../lib/xlsx-lite.ts";
import {
  rowsFromSheet, rowsFromMalExport, leftOutReason, typeKey, cleanTitle, pickEntry, searchQuery,
} from "../lib/mal-list.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}

// ── reading an .xlsx ─────────────────────────────────────────────────────────
// A copy of a "Completed" list page, made with openpyxl (scripts/fixtures; made-up rows).
const sheet = await readFirstSheet(new Uint8Array(readFileSync(new URL("./fixtures/mal-list-page.xlsx", import.meta.url))));
eq(sheet[3].slice(1, 7), ["#", "Image", "Anime Title", "Score", "Type", "Progress"], "the header row, cells in their columns");
eq(sheet[4][3], "Attack on Titan \nAdd - More", "a shared string with its line break");
eq(sheet[4][1], 1, "numbers are numbers");
const rows = rowsFromSheet(sheet);
eq(rows.length, 7, "every entry row, not the page's header and footer lines");
eq(rows[0], { malId: null, title: "Attack on Titan", mediaType: "tv", episodes: 25, score: 7 }, "a row");
eq(rows[1].score, null, "score '-' is none");
eq(rows.map((r) => r.mediaType), ["tv", "tv_special", "movie", "ona", "tv", "ova", "ona"], "types");
eq(rows[5].title, 'Tom & Jerry <Test> "quoted"', "XML escapes undone");
eq(rows[6].title, "Saiki Kusuo no Ψ-nan (ONA)", "non-Latin letters");
eq(rowsFromSheet([["nothing here"]]), [], "no header row: nothing");

eq(sharedStrings('<sst><si><t>a</t></si><si><r><t>b</t></r><r><t xml:space="preserve"> c</t></r></si></sst>'), ["a", "b c"], "rich text runs join");
eq(sheetRows('<sheetData><row r="1"><c r="C1" t="inlineStr"><is><t>x</t></is></c><c r="E1"><v>2.5</v></c></row><row r="2"/></sheetData>', []),
  [[null, null, "x", null, 2.5], []], "inline strings, gaps, an empty row");
eq(decodeXml("&lt;&#65;&#x42;&amp;&quot;"), '<AB&"', "entities");
let threw = false;
try { await readFirstSheet(new Uint8Array([1, 2, 3])); } catch { threw = true; }
eq(threw, true, "not a zip: an error, not garbage");

eq(cleanTitle("Re:ZERO -Starting Life in Another World- Season 2 \nAdd - More"), "Re:ZERO -Starting Life in Another World- Season 2", "title cleaned");
eq(cleanTitle("Charlotte Add - More"), "Charlotte", "…on one line too");
eq(["TV", "TV Special", "tv_special", "Movie", "OVA", "ONA", "Special", "Music", "PV", "CM", "?"].map(typeKey),
  ["tv", "tv_special", "tv_special", "movie", "ova", "ona", "special", "music", "pv", "cm", "unknown"], "type keys");

// ── MyAnimeList's own export ─────────────────────────────────────────────────
const xml = `<?xml version="1.0"?><myanimelist>
<anime><series_animedb_id>16498</series_animedb_id><series_title><![CDATA[Shingeki no Kyojin]]></series_title>
<series_type>TV</series_type><series_episodes>25</series_episodes><my_score>7</my_score><my_status>Completed</my_status></anime>
<anime><series_animedb_id>5114</series_animedb_id><series_title><![CDATA[Fullmetal Alchemist: Brotherhood]]></series_title>
<series_type>TV</series_type><series_episodes>64</series_episodes><my_score>0</my_score><my_status>Plan to Watch</my_status></anime>
<anime><series_animedb_id>28851</series_animedb_id><series_title>Koe no Katachi &amp; more</series_title>
<series_type>Movie</series_type><series_episodes>1</series_episodes><my_score>8</my_score><my_status>Completed</my_status></anime>
</myanimelist>`;
eq(rowsFromMalExport(xml), [
  { malId: 16498, title: "Shingeki no Kyojin", mediaType: "tv", episodes: 25, score: 7 },
  { malId: 28851, title: "Koe no Katachi & more", mediaType: "movie", episodes: 1, score: 8 },
], "completed entries only, with ids; score 0 is none");

// ── seasons, and what is left out ────────────────────────────────────────────
const why = (mediaType, episodes, duration = null) => leftOutReason({ mediaType, episodes, duration });
eq(why("tv", 25, 24), null, "a TV season");
eq(why("tv", 120, 5), null, "a TV season of five-minute episodes is still a season");
eq(why("ona", 12, 24), null, "a web series season");
eq(why("ona", 5, 17), null, "…with shorter episodes");
eq(why("ona", 13, 4), "short", "web chibi shorts");
eq(why("ona", 12, null), null, "duration unknown: kept");
eq(why("ona", 1, 104), "one_episode", "a single-episode web release (a film)");
eq(why("tv", 7, 25), null, "a seven-episode TV arc");
eq([why("movie", 1), why("ova", 2), why("special", 2), why("tv_special", 1), why("music", 1), why("pv", 1), why("cm", 1), why("unknown", 3)],
  ["movie", "ova", "special", "tv_special", "music", "promo", "promo", "other"], "the rest");

// ── matching a title-only row ────────────────────────────────────────────────
const entry = (id, title, titleEn, mediaType, episodes, synonyms = []) =>
  ({ id, title, titleEn, synonyms, mediaType, episodes });
const hxh = [entry(136, "Hunter x Hunter", null, "tv", 62), entry(11061, "Hunter x Hunter (2011)", "Hunter x Hunter", "tv", 148)];
const row = (title, mediaType, episodes, malId = null) => ({ malId, title, mediaType, episodes, score: null });
eq(pickEntry(row("Hunter x Hunter", "tv", 148), hxh)?.id, 11061, "same name: the episode count decides");
eq(pickEntry(row("Hunter x Hunter", "tv", 62), hxh)?.id, 136, "…the other one");
eq(pickEntry(row("Hunter x Hunter", "tv", 30), hxh), null, "still two: left for you");
const aot = [
  entry(16498, "Shingeki no Kyojin", "Attack on Titan", "tv", 25),
  entry(25777, "Shingeki no Kyojin Season 2", "Attack on Titan Season 2", "tv", 12),
  entry(18397, "Shingeki no Kyojin OVA", "Attack on Titan OVA", "ova", 8),
];
eq(pickEntry(row("attack on titan", "tv", 25), aot)?.id, 16498, "by English title, any case — not 'Season 2'");
eq(pickEntry(row("Shingeki no Kyojin Season 2", "tv", 12), aot)?.id, 25777, "by the main title");
eq(pickEntry(row("Attack on Titan", "tv", 99), aot)?.id, 16498, "episode count differs, one TV entry by that name: it");
eq(pickEntry(row("Attack on Titan Season 9", "tv", 12), aot), null, "no such title: nothing (no fuzzy guess)");
eq(pickEntry(row("AoT", "tv", 25), [entry(16498, "Shingeki no Kyojin", "Attack on Titan", "tv", 25, ["AoT"])])?.id, 16498, "by a synonym");
const voice = [entry(28851, "Koe no Katachi", "A Silent Voice", "movie", 1), entry(37000, "Koe no Katachi Specials", "A Silent Voice Specials", "special", 2)];
eq(pickEntry(row("A Silent Voice", "movie", 1), voice)?.id, 28851, "the film, not its specials");
eq(pickEntry(row("Re:ZERO -Starting Life in Another World- Season 2", "tv", 13),
  [entry(39587, "Re:Zero kara Hajimeru Isekai Seikatsu 2nd Season", "Re:ZERO -Starting Life in Another World- Season 2", "tv", 13)])?.id, 39587,
  "punctuation in titles");
eq(pickEntry(row("Anything", "tv", 12, 25777), aot)?.id, 25777, "a row with an id: by id");
eq(pickEntry(row("Anything", "tv", 12, 1), aot), null, "…not among the results: nothing");

eq(searchQuery("Charlotte"), "Charlotte", "short titles searched as they are");
const long = "Cautious Hero: The Hero Is Overpowered but Overly Cautious Recap and a few more words";
eq(searchQuery(long).length <= 64 && long.startsWith(searchQuery(long)) && !searchQuery(long).endsWith(" "), true, "long titles cut at a word");

console.log(`${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
