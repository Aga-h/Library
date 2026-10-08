// Manga from MyAnimeList. One entry is one series. The rules: format from the media type, who
// wrote and who drew it from the credits' roles, "ongoing" from the publishing status, and — when
// it's already in the library — fill blanks and grow counts, never overwrite what you entered.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-mal-manga.mjs
import {
  toManga, formatOf, isOngoing, NOVEL_MEDIA, titleOf, creditsOf, rowFromManga, matchExisting, updatesFromManga,
} from "../lib/mal-manga.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}

const credit = (first, last, role) => ({ node: { id: 1, first_name: first, last_name: last }, role });
const raw = (over = {}) => ({
  id: 23390,
  title: "Shingeki no Kyojin",
  alternative_titles: { synonyms: ["AoT", "SnK"], en: "Attack on Titan", ja: "進撃の巨人" },
  start_date: "2009-09-09",
  media_type: "manga",
  status: "finished",
  num_volumes: 34,
  num_chapters: 141,
  authors: [credit("Hajime", "Isayama", "Story & Art")],
  main_picture: { medium: "https://cdn.myanimelist.net/images/manga/2/37846.jpg", large: "https://cdn.myanimelist.net/images/manga/2/37846l.jpg" },
  ...over,
});

// ── reading MyAnimeList's answer ─────────────────────────────────────────────
const aot = toManga(raw());
eq(aot.title, "Shingeki no Kyojin", "main title");
eq(aot.titleEn, "Attack on Titan", "English title");
eq(aot.synonyms, ["AoT", "SnK"], "synonyms");
eq(aot.year, 2009, "year from the start date");
eq([aot.volumes, aot.chapters], [34, 141], "counts");
eq(aot.writers, ["Hajime Isayama"], "Story & Art writes it");
eq(aot.artists, [], "…and nobody else drew it");
eq(aot.cover, "https://cdn.myanimelist.net/images/manga/2/37846l.jpg", "the large cover");
eq(toManga(raw({ num_volumes: 0, num_chapters: 0, status: "currently_publishing" })).volumes, null, "0 means unknown");
eq(toManga(raw({ main_picture: { large: "https://evil.example/x.jpg" } })).cover, null, "covers only from MyAnimeList's CDN");
eq(toManga(raw({ main_picture: { medium: "http://cdn.myanimelist.net/x.jpg" } })).cover, null, "…and only https");
eq(toManga({ id: 5 }), null, "no title: unusable");
eq(toManga({ title: "x" }), null, "no id: unusable");
eq(toManga(raw({ authors: undefined, alternative_titles: undefined, start_date: undefined })).writers, [], "missing optional parts are fine");

const deathNote = toManga(raw({ authors: [credit("Tsugumi", "Ohba", "Story"), credit("Takeshi", "Obata", "Art")] }));
eq([deathNote.writers, deathNote.artists], [["Tsugumi Ohba"], ["Takeshi Obata"]], "Story and Art split");
eq(creditsOf(deathNote), { author: "Tsugumi Ohba", artist: "Takeshi Obata" }, "author and artist columns");
eq(creditsOf(aot), { author: "Hajime Isayama", artist: null }, "one person: no separate artist");
eq(creditsOf(toManga(raw({ authors: [credit("", "CLAMP", "Story & Art")] }))), { author: "CLAMP", artist: null }, "a one-name credit");
eq(creditsOf(toManga(raw({ authors: [credit("Takeshi", "Obata", "Art")] }))), { author: "Takeshi Obata", artist: null }, "only an artist credited: they fill the required author column");
eq(creditsOf(toManga(raw({ authors: [] }))), { author: "Unknown", artist: null }, "nobody credited");

// ── format and publishing ────────────────────────────────────────────────────
eq(["manga", "manhwa", "manhua", "one_shot", "light_novel", "doujinshi"].map(formatOf),
  ["MANGA", "MANHWA", "MANHUA", "MANGA", "MANGA", "MANGA"], "formats");
eq(["manga", "light_novel", "novel", "one_shot"].map((t) => NOVEL_MEDIA.has(t)), [false, true, true, false], "novels are books");
eq(["finished", "discontinued", "currently_publishing", "on_hiatus", "not_yet_published"].map(isOngoing),
  [false, false, true, true, true], "ongoing: still coming out");
eq(titleOf(aot, true), "Attack on Titan", "English title when asked");
eq(titleOf(aot, false), "Shingeki no Kyojin", "main title otherwise");
eq(titleOf(toManga(raw({ alternative_titles: { en: "" } })), true), "Shingeki no Kyojin", "no English title: the main one");

// ── a new row ────────────────────────────────────────────────────────────────
eq(rowFromManga(aot, { english: true, read: false }), {
  malId: 23390, title: "Attack on Titan", author: "Hajime Isayama", artist: null, format: "MANGA",
  totalVolumes: 34, totalChapters: 141, volumesRead: 0, chaptersRead: 0, ongoing: false,
  coverImage: "https://cdn.myanimelist.net/images/manga/2/37846l.jpg",
}, "a new row, unread");
const readRow = rowFromManga(aot, { english: false, read: true });
eq([readRow.volumesRead, readRow.chaptersRead], [34, 141], "read: every volume and chapter");
const opm = toManga(raw({ id: 44347, title: "One Punch-Man", status: "currently_publishing", num_volumes: 0, num_chapters: 0 }));
const opmRow = rowFromManga(opm, { english: false, read: true });
eq([opmRow.ongoing, opmRow.totalChapters, opmRow.chaptersRead], [true, null, 0], "an ongoing series can't be marked finished");

// ── already in the library ───────────────────────────────────────────────────
const library = [
  { id: "a", title: "attack on titan", malId: null },
  { id: "b", title: "Berserk", malId: 2 },
  { id: "c", title: "Shingeki no Kyojin", malId: 999 },
];
eq(matchExisting(aot, library)?.id, "a", "a hand-added one found by its English title, in any case");
eq(matchExisting(toManga(raw({ id: 2, title: "Berserk" })), library)?.id, "b", "linked by MyAnimeList id");
eq(matchExisting(toManga(raw({ id: 7, title: "Something Else", alternative_titles: { en: "" } })), library), null, "no match");
eq(matchExisting(toManga(raw({ id: 8, alternative_titles: { synonyms: [], en: "" } })), [{ id: "c", title: "Shingeki no Kyojin", malId: 999 }]), null,
  "a title already linked to a different entry is not taken over");
eq(matchExisting(toManga(raw({ alternative_titles: { synonyms: ["SnK"], en: "" } })), [{ id: "s", title: "SnK", malId: null }])?.id, "s", "found by a synonym");

const handAdded = { author: "", artist: null, totalVolumes: null, totalChapters: 100, ongoing: true, coverImage: "https://x.supabase.co/c.jpg" };
eq(updatesFromManga(handAdded, aot), { author: "Hajime Isayama", totalVolumes: 34, totalChapters: 141, ongoing: false },
  "fills blanks, grows counts, ends a finished series; keeps your cover");
eq(updatesFromManga({ author: "Isayama", artist: null, totalVolumes: 40, totalChapters: 200, ongoing: false, coverImage: null }, aot),
  { coverImage: aot.cover }, "never shrinks your counts or replaces your author");
eq(updatesFromManga({ author: "Murata", artist: null, totalVolumes: 10, totalChapters: 120, ongoing: true, coverImage: "c" }, opm), {},
  "still publishing, no counts on MyAnimeList: nothing to change");
eq(updatesFromManga({ author: "Ohba", artist: null, totalVolumes: 34, totalChapters: 141, ongoing: false, coverImage: "c" }, deathNote),
  { artist: "Takeshi Obata" }, "adds a missing artist");

console.log(`${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
