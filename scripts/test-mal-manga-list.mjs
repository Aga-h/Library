// Importing a whole MyAnimeList manga list. What decides whether it can be trusted: each line's
// MyAnimeList id is read from the list page's title link (so nothing is matched by guesswork), the
// export and the API read the same, novels and unfinished ones are left out, and a title-only line
// is only ever matched exactly.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-mal-manga-list.mjs
import { readFileSync } from "node:fs";
import { readFirstSheetWithLinks, sheetLinks } from "../lib/xlsx-lite.ts";
import {
  rowsFromMangaSheet, rowsFromMangaExport, rowsFromApiManga, mangaIdFromLink, mangaTypeKey, mangaLeftOut,
  pickManga, isAnimeExport, cleanMangaTitle, progressCell,
} from "../lib/mal-manga-list.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}

// ── a copy of the list page ──────────────────────────────────────────────────
const { rows, links } = await readFirstSheetWithLinks(new Uint8Array(readFileSync(new URL("./fixtures/mal-manga-list-page.xlsx", import.meta.url))));
eq(links[2]?.[3], "https://myanimelist.net/manga/2/Berserk", "a title cell's link is read, aligned with its row");
eq(rowsFromMangaSheet(rows, links).map((r) => [r.key, r.malId, r.title, r.mediaType, r.status, r.chaptersRead]), [
  ["mal:2", 2, "Berserk", "manga", "completed", null],
  ["mal:121496", 121496, "Solo Leveling", "manhwa", "completed", null],
  ["mal:9115", 9115, "Spice & Wolf", "light_novel", "completed", null],
  ["row:6", null, "Hand Typed One-Shot", "one_shot", "completed", null],
], "Completed page: header found past an empty row, ids from links, a link-less line keyed by row, a repeat dropped");

// The "All Manga" page: no Type column, the publishing state stuck to the title, the cover's
// address as text, "read / total" for one being read.
const all = await readFirstSheetWithLinks(new Uint8Array(readFileSync(new URL("./fixtures/mal-manga-all-page.xlsx", import.meta.url))));
eq(rowsFromMangaSheet(all.rows, all.links).map((r) => [r.malId, r.title, r.mediaType, r.status, r.chaptersRead, r.volumesRead]), [
  [114745, "Blue Lock", "unknown", "reading", 339, null],
  [145, "BECK: Mongolian Chop Squad", "unknown", "reading", 23, 2],
  [1, "I Got a Cheat Skill, Too", "unknown", "reading", 50, null],
  [656, "Vagabond", "unknown", "completed", 327, 37],
  [138673, "Look Back", "unknown", "completed", null, 1],
  [111996, "The God of High School", "unknown", "completed", 569, null],
], "All Manga page: no Type column, status stripped from titles (with or without a space), ids from the cover link, reading vs finished from Chapters, the footer ignored");
eq([cleanMangaTitle("Bakuman。Add - More"), cleanMangaTitle("Akame ga Kill! \nAdd - More"), cleanMangaTitle("Title Not Yet PublishedAdd - More")],
  ["Bakuman。", "Akame ga Kill!", "Title"], "titles cleaned");
eq([progressCell("189 / -"), progressCell("- / 34"), progressCell(162), progressCell("-")],
  [{ read: 189, reading: true }, { read: null, reading: true }, { read: 162, reading: false }, { read: null, reading: false }], "progress cells");
eq(rowsFromMangaSheet([["nothing here"]]), [], "no header, no rows");

eq(sheetLinks(
  '<sheetData><row r="2"><c r="A2"/></row><row r="5"><c r="B5"/></row></sheetData><hyperlinks><hyperlink ref="B5" r:id="rId1"/><hyperlink ref="A9" r:id="rId1"/></hyperlinks>',
  '<Relationships><Relationship Id="rId1" Target="https://myanimelist.net/manga/1/a?x=1&amp;y=2"/></Relationships>',
), [undefined, [null, "https://myanimelist.net/manga/1/a?x=1&y=2"]].map((r) => r ?? null),
  "links follow sheetRows' row order even with gaps; a link to a row that isn't there is dropped");

eq([mangaIdFromLink("https://myanimelist.net/manga/2/Berserk"), mangaIdFromLink("https://myanimelist.net/anime/2/x"),
  mangaIdFromLink("https://evil.example/manga/2"), mangaIdFromLink(null)], [2, null, null, null], "ids only from MyAnimeList manga links");
eq([mangaTypeKey("Light Novel"), mangaTypeKey("One-shot"), mangaTypeKey("")], ["light_novel", "one_shot", "unknown"], "type keys");

// ── MyAnimeList's export ─────────────────────────────────────────────────────
const xml = `<?xml version="1.0"?><myanimelist><myinfo><user_export_type>2</user_export_type></myinfo>
<manga><manga_mangadb_id>2</manga_mangadb_id><manga_title><![CDATA[Berserk]]></manga_title><my_status>Completed</my_status></manga>
<manga><manga_mangadb_id>13</manga_mangadb_id><manga_title>One Piece</manga_title><my_read_chapters>1100</my_read_chapters><my_read_volumes>0</my_read_volumes><my_status>Reading</my_status></manga>
<manga><manga_mangadb_id>0</manga_mangadb_id><manga_title>broken</manga_title></manga>
</myanimelist>`;
eq(rowsFromMangaExport(xml).map((r) => [r.key, r.title, r.status, r.chaptersRead, r.volumesRead]),
  [["mal:2", "Berserk", "completed", null, null], ["mal:13", "One Piece", "reading", 1100, null]],
  "the export: CDATA titles, status, progress (0 = none), a line without an id dropped");
eq([isAnimeExport("<myanimelist><anime></anime></myanimelist>"), isAnimeExport(xml)], [true, false], "an anime export is told apart");

// ── the API ──────────────────────────────────────────────────────────────────
const manga = (over) => ({ id: 1, title: "Shingeki no Kyojin", titleEn: null, synonyms: [], year: 2009, mediaType: "manga",
  publishing: "finished", volumes: 34, chapters: 139, writers: [], artists: [], cover: null, ...over });
eq(rowsFromApiManga([
  { manga: manga({ titleEn: "Attack on Titan" }), status: "completed", chaptersRead: 139, volumesRead: 34 },
  { manga: manga({ id: 2, title: "X" }), status: "reading", chaptersRead: 12, volumesRead: null },
]).map((r) => [r.key, r.title, r.status, r.chaptersRead]),
  [["mal:1", "Attack on Titan", "completed", 139], ["mal:2", "X", "reading", 12]], "the API list: English title preferred, progress kept");

// ── what comes in ────────────────────────────────────────────────────────────
eq([
  mangaLeftOut({ mediaType: "manga", status: null }),
  mangaLeftOut({ mediaType: "manhwa", status: "completed" }),
  mangaLeftOut({ mediaType: "one_shot", status: null }),
  mangaLeftOut({ mediaType: "unknown", status: "completed" }),
  mangaLeftOut({ mediaType: "light_novel", status: null }),
  mangaLeftOut({ mediaType: "novel", status: "completed" }),
  mangaLeftOut({ mediaType: "manga", status: "reading" }),
  mangaLeftOut({ mediaType: "manga", status: "plan_to_read" }),
  mangaLeftOut({ mediaType: "manga", status: "on_hold" }),
], [null, null, null, null, "novel", "novel", null, "not_started", "not_started"], "novels and not-started ones are left out; finished and reading come in");

// ── a line with only a title ─────────────────────────────────────────────────
const wolfLn = manga({ id: 9115, title: "Ookami to Koushinryou", titleEn: "Spice & Wolf", mediaType: "light_novel" });
const wolfManga = manga({ id: 9116, title: "Ookami to Koushinryou", titleEn: "Spice and Wolf", mediaType: "manga" });
const other = manga({ id: 5, title: "Spice", mediaType: "manga" });
eq(pickManga({ title: "Spice & Wolf", mediaType: "manga" }, [wolfLn, wolfManga, other])?.id, 9116, "same title (& = and), same type wins");
eq(pickManga({ title: "Spice & Wolf", mediaType: "unknown" }, [wolfLn, other])?.id, 9115, "same title, other type: still the title");
eq(pickManga({ title: "Spice", mediaType: "manga" }, [wolfManga]), null, "no exact title: nothing, never a guess");

if (failures.length) {
  console.error(`✗ ${failures.length} failed, ${pass} passed\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ mal-manga-list: ${pass} assertions passed`);
