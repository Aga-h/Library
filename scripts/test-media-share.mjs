// The media exchange's rules: how long the receiver gets, what each catalogue's item is sent as,
// and what is accepted from the friend's site.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-media-share.mjs
import {
  allowanceDays, dueFrom, elapsedShare, formatMinutes, friendBaseUrl, fromAnime, fromBook, fromFilm, fromManga, fromShow,
  inboxSchema, isShareImage, isSourceId, sendSchema, shareMediaSchema, sourceLink, timeLeft,
} from "../lib/media-share.ts";
import { friendMayCall } from "../lib/session.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

// ─── Allowance: three days per hour, 6–180, 21 unknown ──────────────────────
eq(allowanceDays(120), 6, "a two-hour film is six days");
eq(allowanceDays(90), 6, "a 90-minute film: 2 hours × 3");
eq(allowanceDays(10), 6, "a short is the floor");
eq(allowanceDays(121), 9, "a minute over two hours is a third hour");
eq(allowanceDays(180), 9, "three hours, nine days");
eq(allowanceDays(24 * 24), 30, "a 24×24 cour: 9.6h → 10h → 30 days");
eq(allowanceDays(60 * 59), 177, "under the cap");
eq(allowanceDays(60 * 60), 180, "at the cap");
eq(allowanceDays(60 * 61), 180, "capped at 180");
eq(allowanceDays(1_000 * 24), 180, "One Piece is capped");
eq(allowanceDays(null), 21, "unknown is three weeks");
eq(allowanceDays(0), 21, "zero is unknown");
eq(allowanceDays(-5), 21, "negative is unknown");
eq(allowanceDays(NaN), 21, "NaN is unknown");
for (let m = 1; m < 12000; m += 7) {
  const d = allowanceDays(m);
  ok(d >= 6 && d <= 180 && Number.isInteger(d), `allowance in range for ${m}`);
  ok(allowanceDays(m + 7) >= d, `allowance never shrinks as length grows (${m})`);
  // Three times the first rule (an hour a day, 2–60), everywhere.
  ok(d === 3 * Math.min(60, Math.max(2, Math.ceil(m / 60))), `three times the old allowance (${m})`);
}

const t0 = new Date("2026-11-11T10:00:00Z");
eq(dueFrom(t0, 120).toISOString(), "2026-11-17T10:00:00.000Z", "due six days after arrival");
eq(dueFrom(t0, null).toISOString(), "2026-12-02T10:00:00.000Z", "unknown: three weeks");

// ─── Timer text ──────────────────────────────────────────────────────────────
const due = new Date("2026-11-13T10:00:00Z");
eq(timeLeft(due, t0), { late: false, text: "2d 0h left" }, "two days left");
eq(timeLeft(due, new Date("2026-11-12T08:30:00Z")), { late: false, text: "1d 1h left" }, "a day and an hour");
eq(timeLeft(due, new Date("2026-11-13T06:40:00Z")), { late: false, text: "3h 20m left" }, "hours and minutes under a day");
eq(timeLeft(due, new Date("2026-11-13T09:55:00Z")), { late: false, text: "5m left" }, "minutes");
eq(timeLeft(due, new Date("2026-11-13T10:00:00Z")), { late: false, text: "0m left" }, "exactly due is not late");
eq(timeLeft(due, new Date("2026-11-15T11:00:00Z")), { late: true, text: "2d 1h late" }, "late");
eq(elapsedShare(t0, due, t0), 0, "nothing used at the start");
eq(elapsedShare(t0, due, new Date("2026-11-12T10:00:00Z")), 0.5, "half way");
eq(elapsedShare(t0, due, new Date("2026-11-20T10:00:00Z")), 1, "capped at 1 when late");
eq(elapsedShare(due, due, due), 1, "no span is full");
eq(formatMinutes(125), "2h 5m", "2h 5m");
eq(formatMinutes(45), "45m", "45m");
eq(formatMinutes(180), "3h", "3h");

// ─── From the catalogues ─────────────────────────────────────────────────────
const film = fromFilm({
  id: 129, title: "Spirited Away", year: 2001, runtime: 125, director: "Hayao Miyazaki", studio: "Studio Ghibli",
  language: "JAPANESE", poster: "https://image.tmdb.org/t/p/w500/abc.jpg", imdbId: "tt0245429",
});
eq(film, {
  kind: "movie", sourceId: "129", title: "Spirited Away", altTitle: null, year: 2001,
  image: "https://image.tmdb.org/t/p/w500/abc.jpg", creator: "Hayao Miyazaki", facts: ["Studio Ghibli"],
  lengthMinutes: 125, lengthLabel: "2h 5m",
}, "a film");
eq(fromFilm({ ...{ id: 1, title: "Soon", year: null, runtime: 0, director: null, studio: null, language: "ENGLISH", poster: null, imdbId: null } }).lengthMinutes,
  null, "a film with no runtime has no length");

const show = fromShow({
  id: 1396, name: "Breaking Bad", year: 2008, creator: "Vince Gilligan", network: "AMC", language: "ENGLISH",
  poster: null, imdbId: null, runtime: 47,
  seasons: [
    { number: 1, episodeCount: 7, airedCount: 7, runtime: 48, year: 2008, poster: null },
    { number: 2, episodeCount: 13, airedCount: 13, runtime: null, year: 2009, poster: null },
    { number: 3, episodeCount: null, airedCount: 0, runtime: null, year: null, poster: null },
  ],
});
eq(show.lengthMinutes, 7 * 48 + 13 * 47, "a show: each season at its runtime, else the show's");
eq(show.lengthLabel, "3 seasons · 20 episodes", "show label");
eq(show.facts, ["AMC"], "network");
eq(fromShow({ ...{ id: 2, name: "New", year: null, creator: null, network: null, language: "ENGLISH", poster: null, imdbId: null, runtime: 45, seasons: [] } }).lengthMinutes,
  null, "a show with no episodes has no length");

const anime = {
  id: 52991, title: "Sousou no Frieren", titleEn: "Frieren: Beyond Journey's End", synonyms: [], year: 2023,
  startDate: "2023-09-29", season: "FALL", mediaType: "tv", airing: "finished", episodes: 28, duration: 24,
  studio: "Madhouse", poster: "https://cdn.myanimelist.net/images/anime/1015/138006l.jpg", sequels: [], prequels: [],
};
const a = fromAnime(anime);
eq([a.lengthMinutes, a.lengthLabel, a.altTitle, a.creator, a.facts], [672, "28 episodes × 24m", "Frieren: Beyond Journey's End", "Madhouse", ["TV"]], "anime");
eq(fromAnime({ ...anime, episodes: 1, duration: 124, mediaType: "movie" }).lengthLabel, "2h 4m", "an anime film reads as a runtime");
eq(fromAnime({ ...anime, episodes: null, airing: "airing" }).lengthMinutes, null, "airing, episodes unknown: no length");
eq(fromAnime({ ...anime, episodes: null, airing: "airing" }).facts, ["TV", "Still airing"], "still airing");
eq(fromAnime({ ...anime, duration: null }).lengthLabel, "28 episodes", "episodes without duration");
eq(fromAnime({ ...anime, titleEn: "Sousou no Frieren" }).altTitle, null, "no alt title when it's the same");

const manga = {
  id: 2, title: "Berserk", titleEn: "Berserk", synonyms: [], year: 1989, mediaType: "manga", publishing: "currently_publishing",
  volumes: 42, chapters: null, writers: ["Kentarou Miura"], artists: ["Kentarou Miura"], cover: null,
};
const m = fromManga(manga);
eq([m.lengthMinutes, m.lengthLabel, m.creator, m.facts, m.altTitle], [42 * 45, "42 volumes", "Kentarou Miura", ["Still publishing"], null], "manga by volumes");
eq(fromManga({ ...manga, chapters: 380 }).lengthMinutes, 380 * 5, "chapters win over volumes");
eq(fromManga({ ...manga, chapters: 380 }).lengthLabel, "42 volumes · 380 chapters", "both counted");
eq(fromManga({ ...manga, volumes: null }).lengthMinutes, null, "neither: unknown");

const book = fromBook({
  id: "gb:abc", title: "Mistborn", author: "Brandon Sanderson", year: 2006, pages: 541, cover: null, coverThumb: null,
  publisher: "Tor", openLibraryId: null, googleBooksId: "t_ZYYXZq4RgC",
});
eq([book.sourceId, book.lengthMinutes, book.lengthLabel, book.creator], ["t_ZYYXZq4RgC", 812, "541 pages", "Brandon Sanderson"], "book");
eq(allowanceDays(book.lengthMinutes), 42, "a 541-page book: 14 hours → 42 days");

// ─── Ids, links, images ──────────────────────────────────────────────────────
ok(isSourceId("movie", "129"), "numeric id");
ok(!isSourceId("movie", "0129"), "no leading zero");
ok(!isSourceId("anime", "12a"), "letters refused for MAL");
ok(!isSourceId("movie", "../etc"), "path refused");
ok(isSourceId("book", "t_ZYYXZq4RgC"), "book id");
ok(!isSourceId("book", "a/b"), "slash refused in a book id");
eq(sourceLink("anime", "52991"), "https://myanimelist.net/anime/52991", "MAL link");
eq(sourceLink("tv", "1396"), "https://www.themoviedb.org/tv/1396", "TMDB tv link");
eq(sourceLink("book", "abc_DEF1"), "https://books.google.com/books?id=abc_DEF1", "Google Books link");
eq(sourceLink("movie", "x"), null, "no link for a bad id");
ok(isShareImage("https://image.tmdb.org/t/p/w500/a.jpg"), "TMDB image");
ok(isShareImage("https://cdn.myanimelist.net/images/anime/1/2.jpg"), "MAL image");
ok(!isShareImage("http://image.tmdb.org/t/p/w500/a.jpg"), "http refused");
ok(!isShareImage("https://evil.example/a.jpg"), "other hosts refused");
ok(!isShareImage("javascript:alert(1)"), "script URL refused");
ok(!isShareImage("not a url"), "garbage refused");

// ─── What the friend's site may send ─────────────────────────────────────────
const inbox = { id: "3f1c3a5e-8d0f-4b8a-9d0e-0b5d6f1f2a3b", sentAt: "2026-11-11T10:00:00.000Z", note: "watch this", media: film };
ok(inboxSchema.safeParse(inbox).success, "a good inbox body");
ok(!inboxSchema.safeParse({ ...inbox, id: "1" }).success, "id must be a uuid");
ok(!inboxSchema.safeParse({ ...inbox, sentAt: "yesterday" }).success, "sentAt must be a date");
ok(!inboxSchema.safeParse({ ...inbox, note: "x".repeat(501) }).success, "note too long");
ok(!inboxSchema.safeParse({ ...inbox, media: { ...film, kind: "podcast" } }).success, "unknown kind");
ok(!inboxSchema.safeParse({ ...inbox, media: { ...film, sourceId: "abc" } }).success, "bad id for the kind");
ok(!inboxSchema.safeParse({ ...inbox, media: { ...film, title: " " } }).success, "blank title");
ok(!inboxSchema.safeParse({ ...inbox, media: { ...film, facts: Array(7).fill("x") } }).success, "too many facts");
ok(!inboxSchema.safeParse({ ...inbox, media: { ...film, lengthMinutes: -3 } }).success, "negative length");
eq(shareMediaSchema.parse({ ...film, image: "https://evil.example/a.jpg" }).image, null, "a foreign cover is dropped, not refused");
eq(shareMediaSchema.parse(film).image, film.image, "a catalogue cover is kept");
ok(!inboxSchema.safeParse(null).success, "null body");
ok(sendSchema.safeParse({ kind: "anime", sourceId: "52991" }).success, "send body");
ok(!sendSchema.safeParse({ kind: "game", sourceId: "1" }).success, "send: unknown kind");

// ─── The friend's address and calls ──────────────────────────────────────────
eq(friendBaseUrl("https://www.friend.site/"), "https://www.friend.site", "origin kept");
eq(friendBaseUrl("https://www.friend.site/some/path?x=1"), "https://www.friend.site", "path dropped");
eq(friendBaseUrl("http://friend.site"), null, "plain http refused");
eq(friendBaseUrl("http://localhost:3002"), "http://localhost:3002", "http on this machine, for testing");
eq(friendBaseUrl("https://user:pw@friend.site"), null, "credentials in the URL refused");
eq(friendBaseUrl(""), null, "unset");
eq(friendBaseUrl("ftp://x"), null, "other schemes");
ok(friendMayCall("POST", "/api/exchange/inbox"), "friend may send");
ok(friendMayCall("POST", "/api/exchange/inbox/3f1c3a5e-8d0f-4b8a-9d0e-0b5d6f1f2a3b/finished"), "friend may say finished");
ok(!friendMayCall("GET", "/api/exchange/inbox"), "not GET");
ok(!friendMayCall("POST", "/api/exchange/send"), "friend may not send from here");
ok(!friendMayCall("POST", "/api/exchange/inbox/../send"), "no traversal");
ok(!friendMayCall("POST", "/api/exchange/3f1c3a5e-8d0f-4b8a-9d0e-0b5d6f1f2a3b/finish"), "friend may not finish ours");
ok(!friendMayCall("POST", "/api/exchange/inbox/x/finished"), "id must look like a uuid");

if (failures.length) {
  console.error(`media-share: ${failures.length} failed, ${pass} passed\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`media-share: ${pass} assertions passed`);
