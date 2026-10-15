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
  pickManga, isAnimeExport,
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
eq(rowsFromMangaSheet(rows, links).map((r) => [r.key, r.malId, r.title, r.mediaType, r.status]), [
  ["mal:2", 2, "Berserk", "manga", null],
  ["mal:121496", 121496, "Solo Leveling", "manhwa", null],
  ["mal:9115", 9115, "Spice & Wolf", "light_novel", null],
  ["row:6", null, "Hand Typed One-Shot", "one_shot", null],
], "rows: header found past an empty row, ids from links, a link-less line keyed by row, a repeat dropped");
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
<manga><manga_mangadb_id>13</manga_mangadb_id><manga_title>One Piece</manga_title><my_status>Reading</my_status></manga>
<manga><manga_mangadb_id>0</manga_mangadb_id><manga_title>broken</manga_title></manga>
</myanimelist>`;
eq(rowsFromMangaExport(xml).map((r) => [r.key, r.title, r.status]), [["mal:2", "Berserk", "completed"], ["mal:13", "One Piece", "reading"]],
  "the export: CDATA titles, status, a line without an id dropped");
eq([isAnimeExport("<myanimelist><anime></anime></myanimelist>"), isAnimeExport(xml)], [true, false], "an anime export is told apart");

// ── the API ──────────────────────────────────────────────────────────────────
const manga = (over) => ({ id: 1, title: "Shingeki no Kyojin", titleEn: null, synonyms: [], year: 2009, mediaType: "manga",
  publishing: "finished", volumes: 34, chapters: 139, writers: [], artists: [], cover: null, ...over });
eq(rowsFromApiManga([manga({ titleEn: "Attack on Titan" }), manga({ id: 2, title: "X" })]).map((r) => [r.key, r.title, r.status]),
  [["mal:1", "Attack on Titan", "completed"], ["mal:2", "X", "completed"]], "the API list: English title preferred, all completed");

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
], [null, null, null, null, "novel", "novel", "not_completed", "not_completed"], "novels and unfinished ones are left out, everything else comes in");

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
