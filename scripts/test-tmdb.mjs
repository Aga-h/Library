// Importing films from TMDB. What decides whether it can be trusted: TMDB's answers are read
// defensively (a poster path is never stitched into a URL unchecked, missing fields stay blank),
// and an import never touches what you set yourself — status, rating, notes, your own cover — and
// never pulls a film out of a universe you put it in.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-tmdb.mjs
import {
  posterUrl, isTmdbImage, yearOf, languageFor, directorsOf, studioOf, toFilm, toCollection, toKeyword,
  toDetails, normaliseTitle, planImport, byRelease, releaseDateOf,
} from "../lib/tmdb.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

// ── posters ──────────────────────────────────────────────────────────────────
eq(posterUrl("/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg"), "https://image.tmdb.org/t/p/w500/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg", "a poster is stored at w500");
eq(posterUrl("/a-b_c.png", "w92"), "https://image.tmdb.org/t/p/w92/a-b_c.png", "…and thumbnailed at w92");
for (const bad of [null, undefined, "", "abc.jpg", "/../../x.jpg", "/a.jpg?x=1", "//evil.com/a.jpg", "/a.svg", "https://x/a.jpg", 42]) {
  eq(posterUrl(bad), null, `${JSON.stringify(bad)} is not a poster path`);
}
ok(isTmdbImage("https://image.tmdb.org/t/p/w500/a.jpg"), "TMDB posters are recognised");
ok(!isTmdbImage("https://image.tmdb.org.attacker.io/a.jpg"), "a look-alike host is not TMDB");
ok(!isTmdbImage("https://xyz.supabase.co/storage/v1/object/public/covers/a.jpg"), "your own uploads are not");
ok(!isTmdbImage(null) && !isTmdbImage("not a url"), "nothing and junk are not");

// ── fields ───────────────────────────────────────────────────────────────────
eq(yearOf("2008-04-30"), 2008, "a release date gives its year");
for (const bad of ["", null, "2008", "30-04-2008", "0000-01-01", 2008]) eq(yearOf(bad), null, `${JSON.stringify(bad)} gives no year`);
eq(languageFor("en"), "ENGLISH", "en is English");
eq(languageFor("ja"), "JAPANESE", "ja is Japanese");
eq(languageFor("cn"), "CHINESE", "TMDB's cn (Cantonese) is Chinese");
eq(languageFor("KO"), "KOREAN", "case does not matter");
eq(languageFor("hi"), "ENGLISH", "a language the library has no entry for falls back to the column default");
eq(languageFor(undefined), "ENGLISH", "…as does none");
eq(directorsOf({ crew: [
  { job: "Producer", name: "Kevin Feige" },
  { job: "Director", name: "Anthony Russo" },
  { job: "Director", name: "Joe Russo" },
  { job: "Director", name: "Joe Russo" },
] }), "Anthony Russo, Joe Russo", "every director, once each, producers left out");
eq(directorsOf({ crew: [{ job: "Writer", name: "X" }] }), null, "no director credited, none stored");
eq(directorsOf(null), null, "no credits, no director");
eq(studioOf([{ name: "  " }, { name: "Marvel Studios" }, { name: "Disney" }]), "Marvel Studios", "the first named company is the studio");
eq(studioOf([]), null, "no companies, no studio");

eq(toFilm({ id: 1726, title: "Iron Man", release_date: "2008-04-30", poster_path: "/a.jpg" }),
  { id: 1726, title: "Iron Man", year: 2008, released: "2008-04-30", poster: "https://image.tmdb.org/t/p/w92/a.jpg" }, "a list row");
eq(releaseDateOf(" 2011-05-06 "), "2011-05-06", "a release date is kept for ordering");
eq(releaseDateOf("2011-5-6"), null, "…only in TMDB's own format");
eq(toFilm({ id: 1, title: "  " }), null, "no title, no film");
eq(toFilm({ id: "x", title: "A" }), null, "a junk id, no film");
eq(toCollection({ id: 1241, name: "Harry Potter Collection", poster_path: null }),
  { id: 1241, name: "Harry Potter Collection", poster: null }, "a collection");
eq(toKeyword({ id: 180547, name: "marvel cinematic universe (mcu)" }), { id: 180547, name: "marvel cinematic universe (mcu)" }, "a keyword");

const endgame = toDetails({
  id: 299534, title: "Avengers: Endgame", release_date: "2019-04-24", runtime: 181,
  original_language: "en", poster_path: "/or06FN3Dka5tukK1e9sl16pB3iy.jpg", imdb_id: "tt4154796",
  production_companies: [{ name: "Marvel Studios" }],
  credits: { crew: [{ job: "Director", name: "Anthony Russo" }, { job: "Director", name: "Joe Russo" }] },
});
eq(endgame, {
  id: 299534, title: "Avengers: Endgame", year: 2019, runtime: 181, director: "Anthony Russo, Joe Russo",
  studio: "Marvel Studios", language: "ENGLISH", poster: "https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg",
  imdbId: "tt4154796",
}, "full details");
const upcoming = toDetails({ id: 9, title: "Next One", release_date: "", runtime: 0, imdb_id: null });
eq([upcoming.year, upcoming.runtime, upcoming.director, upcoming.poster, upcoming.imdbId], [null, 0, null, null, null],
  "a film not out yet: no year, runtime 0 (not known), no blanks invented");
eq(toDetails({ id: 9, title: "X", imdb_id: "javascript:alert(1)", runtime: -5 }).imdbId, null, "only a real IMDb id is kept");
eq(toDetails({ id: 9, title: "X", runtime: 99.5 }).runtime, 0, "a nonsense runtime is not known");

// ── landing an import ────────────────────────────────────────────────────────
const film = (id, title, year, extra = {}) => ({
  id, title, year, runtime: 120, director: "Dir", studio: "Studio", language: "ENGLISH",
  poster: `https://image.tmdb.org/t/p/w500/p${id}.jpg`, imdbId: `tt000000${id}`, ...extra,
});
const row = (id, extra = {}) => ({
  id, title: "T", year: null, tmdbId: null, imdbId: null, director: null, studio: null, runtime: 0,
  coverImage: null, universeId: null, universeName: null, ...extra,
});

const fresh = planImport([], [film(1, "Iron Man", 2008), film(2, "Thor", 2011), film(1, "Iron Man", 2008)], "mcu");
eq(fresh.create.map((c) => c.tmdbId), [1, 2], "new films are created, a duplicate in the batch only once");
eq(fresh.create[0], {
  title: "Iron Man", year: 2008, runtime: 120, director: "Dir", studio: "Studio", language: "ENGLISH",
  coverImage: "https://image.tmdb.org/t/p/w500/p1.jpg", tmdbId: 1, imdbId: "tt0000001",
}, "…with every detail");
ok(fresh.create.every((c) => !("status" in c) && !("universeId" in c) && !("rating" in c)),
  "the plan never sets status, universe or rating on a new film — the caller decides those");
eq(fresh.report.map((r) => r.outcome), ["added", "added"], "both reported as added");

// Already imported, sitting in this universe, with your own edits.
const mine = row("m1", {
  title: "Iron Man (my title)", year: 2008, tmdbId: 1, imdbId: "tt0000001", director: "Jon Favreau", studio: "My studio",
  runtime: 126, coverImage: "https://xyz.supabase.co/storage/v1/object/public/covers/mine.jpg", universeId: "mcu", universeName: "MCU",
});
const again = planImport([mine], [film(1, "Iron Man", 2008, { director: "Someone else", runtime: 999 })], "mcu");
eq(again.create.length + again.update.length, 0, "importing a film you have, complete, changes nothing at all");
eq(again.report[0].outcome, "already", "…and says it was already here");
eq(again.report[0].title, "Iron Man (my title)", "…by the name you gave it");

// Imported before release: runtime 0, no poster, no year yet.
const early = row("m2", { title: "Next One", tmdbId: 9, universeId: "mcu", universeName: "MCU" });
const released = planImport([early], [film(9, "Next One", 2027, { runtime: 140 })], "mcu");
eq(released.update, [{ id: "m2", data: {
  imdbId: "tt0000009", director: "Dir", studio: "Studio", runtime: 140, year: 2027, coverImage: "https://image.tmdb.org/t/p/w500/p9.jpg",
} }], "importing again after release fills every blank, runtime included");
ok(released.update.every((u) => Object.keys(u.data).every((k) =>
  ["tmdbId", "imdbId", "director", "studio", "runtime", "year", "coverImage", "universeId"].includes(k))),
  "an import can never write title, status, rating, rewatches, notes or language onto an existing film");

// Standalone films move in; films in another universe stay put.
const loose = row("m3", { title: "Thor", year: 2011, tmdbId: 2, runtime: 115 });
const other = row("m4", { title: "Hulk", year: 2008, tmdbId: 3, runtime: 112, universeId: "phase", universeName: "Phase One" });
const placing = planImport([loose, other], [film(2, "Thor", 2011), film(3, "The Incredible Hulk", 2008)], "mcu");
eq(placing.report.map((r) => [r.tmdbId, r.outcome, r.where ?? null]),
  [[2, "moved", null], [3, "elsewhere", "Phase One"]], "standalone moves in, another universe's film is left and reported");
eq(placing.update.find((u) => u.id === "m3").data.universeId, "mcu", "the move is written");
ok(!placing.update.some((u) => u.data.universeId && u.id === "m4"), "the other universe's film is never moved");

// Importing standalone (no universe) never pulls a film out of its universe.
const standalone = planImport([other], [film(3, "The Incredible Hulk", 2008)], null);
eq(standalone.report[0].outcome, "elsewhere", "a film in a universe stays there when imported standalone");
ok(!standalone.update.some((u) => "universeId" in u.data), "…and nothing moves it");
eq(planImport([loose], [film(2, "Thor", 2011)], null).report[0].outcome, "already", "standalone into standalone is already there");

// Hand-added films are matched by title and year, once.
const handIron = row("h1", { title: "iron man", year: 2008, runtime: 126 });
const handDune = row("h2", { title: "Dune", year: 1984, runtime: 137 });
const handNoYear = row("h3", { title: "Fast & Furious", year: null, runtime: 107 });
const matched = planImport([handIron, handDune, handNoYear], [
  film(1, "Iron Man", 2008),
  film(438631, "Dune", 2021),
  film(13804, "Fast and Furious", 2009),
], null);
eq(matched.report.map((r) => [r.tmdbId, r.outcome, r.movieId ?? null]),
  [[1, "linked", "h1"], [438631, "added", null], [13804, "linked", "h3"]],
  "same title and year links; a different year is a different film; a row with no year links");
eq(matched.update.find((u) => u.id === "h1").data.tmdbId, 1, "linking writes the TMDB id");
ok(!("runtime" in matched.update.find((u) => u.id === "h1").data), "…but keeps your runtime");
const twice = planImport([handNoYear], [film(10, "Fast & Furious", 2009), film(11, "Fast & Furious", 2009)], null);
eq(twice.report.map((r) => r.outcome), ["linked", "added"], "one hand-added row is claimed by one film only");
const preferExact = planImport([row("y0", { title: "Dune", year: null }), row("y1", { title: "Dune", year: 2021 })],
  [film(438631, "Dune", 2021)], null);
eq(preferExact.report[0].movieId, "y1", "an exact year beats a row with no year");
const tmdbFirst = planImport([row("hand", { title: "Thor", year: 2011 }), row("imp", { title: "Thor", year: 2011, tmdbId: 2 })],
  [film(2, "Thor", 2011)], null);
eq(tmdbFirst.report[0].movieId, "imp", "a TMDB id match beats a title match");
eq(normaliseTitle("Star Wars: Episode IV – A New Hope"), normaliseTitle("star wars episode iv a new hope"), "punctuation does not count");

eq(planImport([], [], "mcu"), { create: [], update: [], report: [] }, "an empty import changes nothing");

// ── ordering ─────────────────────────────────────────────────────────────────
const order = [{ year: null, title: "Z" }, { year: 2011, title: "Thor" }, { year: 2008, title: "Iron Man" }, { year: 2008, title: "Hulk" }]
  .sort(byRelease).map((f) => f.title);
eq(order, ["Hulk", "Iron Man", "Thor", "Z"], "release order, then title, undated last");
const sameYear = [
  { year: 2011, released: "2011-07-22", title: "Captain America: The First Avenger" },
  { year: 2011, released: "2011-04-21", title: "Thor" },
  { year: 2011, released: null, title: "A 2011 film with no exact date" },
  { year: null, released: null, title: "Untitled" },
  { year: 2008, released: "2008-04-30", title: "Iron Man" },
].sort(byRelease).map((f) => f.title);
eq(sameYear, ["Iron Man", "A 2011 film with no exact date", "Thor", "Captain America: The First Avenger", "Untitled"],
  "within a year, the release date decides — Thor came out before Captain America");
eq([{ year: 2010, title: "Part 10" }, { year: 2010, title: "Part 2" }].sort(byRelease).map((f) => f.title), ["Part 2", "Part 10"],
  "numbers in titles are read as numbers");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
