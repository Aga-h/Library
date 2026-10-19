// Books from Open Library. A work is one book. The rules: work ids, ISBNs, covers only from
// Open Library's CDN, page-count median, matching a hand-added row by title + author, and —
// when it's already in the library — fill blanks, never overwrite what you entered.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-openlibrary.mjs
import {
  workIdOf, isbnOf, searchQueryOf, coverUrl, isOpenLibraryImage, authorsOf, yearOf, toWork,
  hasPages, normaliseAuthor, firstAuthor, authorsMatch, titleKeys, dominantScript, queryFit,
  bestTitle, catalogOf, matchExisting, planImport, updatesFromWork, byYear, OL_IMAGE_HOST,
} from "../lib/openlibrary.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) {
  if (cond) pass++; else failures.push(label);
}

const art = 15155833;
const coverL = `https://${OL_IMAGE_HOST}/b/id/${art}-L.jpg`;
const coverM = `https://${OL_IMAGE_HOST}/b/id/${art}-M.jpg`;

const raw = (over = {}) => ({
  key: "/works/OL82563W",
  title: "Harry Potter and the Philosopher's Stone",
  author_name: ["J. K. Rowling"],
  first_publish_year: 1997,
  cover_i: art,
  number_of_pages_median: 302,
  ...over,
});

// ── ids, ISBNs, search query ─────────────────────────────────────────────────
eq(workIdOf("/works/OL82563W"), "OL82563W", "work key with /works/");
eq(workIdOf("OL82563W"), "OL82563W", "bare work id");
eq(workIdOf("ol82563w"), "OL82563W", "work id is normalised to the canonical case");
eq(workIdOf("/books/OL123M"), null, "an edition key is not a work");
eq(workIdOf("https://openlibrary.org/works/OL82563W"), null, "a URL is not stitched into an id");
eq(workIdOf(""), null, "empty: unusable");
eq(isbnOf("978-0-439-70818-0"), "9780439708180", "ISBN-13, hyphens dropped");
eq(isbnOf("0-439-70818-4"), "0439708184", "ISBN-10");
eq(isbnOf("043970818X"), "043970818X", "ISBN-10 ending in X");
eq(isbnOf("  9780439708180  "), "9780439708180", "ISBN-13 with spaces");
eq(isbnOf("1984"), null, "a year is not an ISBN");
eq(isbnOf("1234567890"), "1234567890", "ten digits are taken as ISBN-10");
eq(isbnOf("1234567890123"), null, "thirteen digits that are not 978/979 are refused");
eq(searchQueryOf("the hobbit"), "the hobbit", "words pass through");
eq(searchQueryOf("978-0-439-70818-0"), "isbn:9780439708180", "an ISBN is searched as isbn:");
eq(searchQueryOf("OL82563W"), "key:/works/OL82563W", "a work id is searched as key:");
eq(searchQueryOf("  The Hobbit  "), "The Hobbit", "surrounding spaces dropped on a title");

// ── covers ───────────────────────────────────────────────────────────────────
eq(coverUrl(art), coverL, "a cover is stored at -L");
eq(coverUrl(art, "M"), coverM, "…and thumbnailed at -M");
eq(coverUrl(0), null, "cover id 0 is the placeholder, refused");
eq(coverUrl(-1), null, "a negative cover id is refused");
eq(coverUrl(1.5), null, "a non-integer cover id is refused");
eq(coverUrl("15155833"), coverL, "a numeric string is accepted");
ok(isOpenLibraryImage(coverL), "Open Library covers are recognised");
ok(!isOpenLibraryImage("https://covers.openlibrary.org.attacker.io/b/id/1-L.jpg"), "a look-alike host is not Open Library");
ok(!isOpenLibraryImage("https://image.tmdb.org/t/p/w500/a.jpg"), "a TMDB poster is not Open Library");
ok(!isOpenLibraryImage(null), "null is not a cover");

// ── reading Open Library's answer ────────────────────────────────────────────
const stone = toWork(raw());
eq(stone, {
  id: "OL82563W", title: "Harry Potter and the Philosopher's Stone", author: "J. K. Rowling",
  year: 1997, pages: 302, cover: coverL, coverThumb: coverM,
}, "a search document");
eq(toWork(raw({ key: "OL82563W" })).id, "OL82563W", "bare key");
eq(toWork(raw({ author_name: ["J. K. Rowling", "Mary GrandPré"] })).author, "J. K. Rowling, Mary GrandPré", "several authors, in order");
eq(toWork(raw({ author_name: [] })).author, "Unknown", "nobody credited");
eq(toWork(raw({ author_name: undefined })).author, "Unknown", "missing authors");
eq(toWork(raw({ number_of_pages_median: 0 })).pages, null, "0 pages means unknown");
eq(toWork(raw({ number_of_pages_median: undefined })).pages, null, "no page count");
eq(toWork(raw({ cover_i: 0 })).cover, null, "placeholder cover dropped");
eq(toWork(raw({ first_publish_year: 0 })).year, null, "year 0 is not a year");
eq(toWork(raw({ first_publish_year: 1997.5 })).year, null, "a fractional year is refused");
eq(toWork({ title: "x" }), null, "no work id: unusable");
eq(toWork({ key: "/works/OL1W" }), null, "no title: unusable");
eq(toWork({
  key: "/works/OL20094984W",
  title: "無職転生 ~異世界行ったら本気だす~ 1 (light novel)",
  author_name: ["理不尽な孫の手"],
  first_publish_year: 2014,
  cover_i: 8758875,
  number_of_pages_median: 320,
  editions: { docs: [{ key: "/books/OL1M", title: "Mushoku Tensei: Jobless Reincarnation, Novel 1", cover_i: 14843031, language: ["eng"] }] },
}, "Mushoku Tensei: Jobless Reincarnation (Light Novel) Vol. 1").title,
  "Mushoku Tensei: Jobless Reincarnation, Novel 1",
  "search uses the English edition title, not 無職転生");
eq(toWork({
  key: "/works/OL20094984W",
  title: "無職転生 ~異世界行ったら本気だす~ 1 (light novel)",
  author_name: ["理不尽な孫の手"],
  editions: { docs: [{ title: "Mushoku Tensei: Jobless Reincarnation, Novel 1", cover_i: 14843031 }] },
}).title,
  "無職転生 ~異世界行ったら本気だす~ 1 (light novel)",
  "without a search query, the work title stays");
eq(catalogOf(stone).openLibraryId, "OL82563W", "an Open Library work becomes a catalogue row");
eq(catalogOf(stone).googleBooksId, null, "…with no Google Books id yet");
eq(hasPages(stone), true, "302 pages: importable");
eq(hasPages(toWork(raw({ number_of_pages_median: 0 }))), false, "unknown pages: not importable");
eq(authorsOf(["  J. K. Rowling  ", "", "Mary GrandPré"]), "J. K. Rowling, Mary GrandPré", "blank names dropped");
eq(yearOf(1997), 1997, "a number year");
eq(yearOf("1997"), 1997, "a string year");
eq(yearOf(999), null, "too early");
eq(yearOf(2101), null, "too late");

eq(normaliseAuthor("J. K. Rowling"), "jkrowling", "initials and spaces collapse");
eq(normaliseAuthor("J.K. Rowling"), "jkrowling", "…even without spaces");
eq(normaliseAuthor("JK Rowling"), "jkrowling", "…and without dots");
eq(firstAuthor("J. K. Rowling, Mary GrandPré"), "J. K. Rowling", "illustrator dropped for matching");
eq(authorsMatch("J. K. Rowling, Mary GrandPré", "JK Rowling"), true, "first author matches despite extra credits");
eq(titleKeys("Piranesi: A Novel"), ["piranesi a novel", "piranesi"], "subtitle is a second key");
eq(titleKeys("The Hobbit"), ["the hobbit"], "no colon: one key");
eq(dominantScript("Mushoku Tensei: Jobless Reincarnation (Light Novel) Vol. 1"), "latin", "English title is Latin");
eq(dominantScript("無職転生 ~異世界行ったら本気だす~ 1 (light novel)"), "cjk", "Japanese work title with '(light novel)' is still CJK");
eq(dominantScript("无职转生"), "cjk", "Chinese is CJK");
ok(queryFit("Mushoku Tensei: Jobless Reincarnation (Light Novel) Vol. 1", "Mushoku Tensei: Jobless Reincarnation (Light Novel) Vol. 1") >
  queryFit("無職転生 ~異世界行ったら本気だす~ 1 (light novel)", "Mushoku Tensei: Jobless Reincarnation (Light Novel) Vol. 1"),
  "an English query fits the English title better than 無職転生");
eq(bestTitle(
  ["無職転生 ~異世界行ったら本気だす~ 1 (light novel)", "Mushoku Tensei: Jobless Reincarnation, Novel 1"],
  "Mushoku Tensei: Jobless Reincarnation (Light Novel) Vol. 1",
), "Mushoku Tensei: Jobless Reincarnation, Novel 1", "pick the English edition title");

// ── already in the library ───────────────────────────────────────────────────
const library = [
  { id: "a", title: "the hobbit", author: "J.R.R. Tolkien", openLibraryId: null, publisher: null, pages: 300, coverImage: null, seriesId: null, seriesName: null },
  { id: "b", title: "The Hobbit", author: "Someone Else", openLibraryId: null, publisher: null, pages: 200, coverImage: null, seriesId: null, seriesName: null },
  { id: "c", title: "Dune", author: "Frank Herbert", openLibraryId: "OL893661W", publisher: null, pages: 500, coverImage: null, seriesId: "s1", seriesName: "Dune" },
];
const hobbit = toWork({
  key: "/works/OL27482W", title: "The Hobbit", author_name: ["J.R.R. Tolkien"],
  first_publish_year: 1937, cover_i: art, number_of_pages_median: 310,
});
eq(matchExisting(hobbit, library)?.id, "a", "a hand-added one found by title and author, in any case");
eq(matchExisting(toWork({ key: "/works/OL893661W", title: "Dune", author_name: ["Frank Herbert"] }), library)?.id, "c", "linked by Open Library id");
eq(matchExisting(toWork({ key: "/works/OL1W", title: "The Hobbit", author_name: ["J.R.R. Tolkien"] }), [{ ...library[0], openLibraryId: "OL999W" }]), null,
  "a title already linked to a different work is not taken over");
eq(matchExisting(toWork({ key: "/works/OL2W", title: "The Hobbit", author_name: ["Some Other Author"] }), library), null,
  "same title, different author: not matched");
eq(matchExisting(toWork({ key: "/works/OL3W", title: "Unknown Book", author_name: ["Pat"] }), [
  { id: "u", title: "Unknown Book", author: "Unknown", openLibraryId: null, publisher: null, pages: 100, coverImage: null, seriesId: null, seriesName: null },
])?.id, "u", "an Unknown author on the hand-added row still matches by title");

const jk = toWork(raw({ author_name: ["JK Rowling"] }));
eq(matchExisting(jk, [{
  id: "h", title: "Harry Potter and the Philosopher's Stone", author: "J. K. Rowling",
  openLibraryId: null, publisher: null, pages: 223, coverImage: "mine.jpg", seriesId: null, seriesName: null,
}])?.id, "h", "J. K. Rowling matches JK Rowling");

// ── a new row / fill-blanks ──────────────────────────────────────────────────
const existing = {
  author: "Unknown", coverImage: null,
};
eq(updatesFromWork(existing, stone), { author: "J. K. Rowling", coverImage: coverL }, "fills Unknown author and a missing cover");
eq(updatesFromWork({ author: "Rowling", coverImage: "https://x.supabase.co/c.jpg" }, stone), {},
  "never replaces your author or your cover");
eq(updatesFromWork({ author: "Unknown", coverImage: "c" }, toWork(raw({ author_name: [] }))), {},
  "an uncredited work does not overwrite Unknown with Unknown");

const hand = {
  id: "h", title: "the hobbit", author: "J.R.R. Tolkien", openLibraryId: null,
  publisher: "Allen & Unwin", pages: 310, coverImage: "mine.jpg", seriesId: null, seriesName: null,
};
const linked = {
  id: "d", title: "Dune", author: "Frank Herbert", openLibraryId: "OL893661W",
  publisher: null, pages: 500, coverImage: null, seriesId: "s1", seriesName: "Dune",
};
const standalone = {
  id: "s", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", openLibraryId: "OL123W",
  publisher: null, pages: 286, coverImage: null, seriesId: null, seriesName: null,
};
const otherSeries = {
  id: "o", title: "The Two Towers", author: "J.R.R. Tolkien", openLibraryId: "OL27501W",
  publisher: null, pages: 352, coverImage: null, seriesId: "lotr", seriesName: "The Lord of the Rings",
};

const incomingHobbit = { ...hobbit, pages: 310 };
const incomingDune = { ...toWork({ key: "/works/OL893661W", title: "Dune", author_name: ["Frank Herbert"], first_publish_year: 1965, cover_i: art, number_of_pages_median: 896 }), pages: 896 };
const incomingNew = { ...toWork(raw()), pages: 302 };
const incomingLeft = { ...toWork({ key: "/works/OL123W", title: "The Left Hand of Darkness", author_name: ["Ursula K. Le Guin"], first_publish_year: 1969, number_of_pages_median: 286, cover_i: art }), pages: 286 };
const incomingTowers = { ...toWork({ key: "/works/OL27501W", title: "The Two Towers", author_name: ["J.R.R. Tolkien"], first_publish_year: 1954, number_of_pages_median: 352 }), pages: 352 };

const added = planImport([hand, linked, standalone, otherSeries], [incomingNew], null, { read: false });
eq(added.create[0], {
  title: incomingNew.title, author: "J. K. Rowling", pages: 302, pagesRead: 0, coverImage: coverL,
  publisher: null, openLibraryId: "OL82563W", googleBooksId: null,
}, "a new unread row");
eq(added.report[0].outcome, "added", "…reported as added");

const readPlan = planImport([], [incomingNew], null, { read: true });
eq(readPlan.create[0].pagesRead, 302, "read: every page");

const linkPlan = planImport([hand], [incomingHobbit], null, { read: true });
eq(linkPlan.create.length, 0, "a hand-added match is not duplicated");
eq(linkPlan.update[0].data.openLibraryId, "OL27482W", "…and is linked");
eq(linkPlan.report[0].outcome, "linked", "…reported as linked");
eq("pages" in (linkPlan.update[0].data), false, "your page count stays (editions differ)");
eq(linkPlan.update[0].data.coverImage, undefined, "your cover stays");
eq(linkPlan.create[0]?.pagesRead, undefined, "read does not mark a book you already have");

const already = planImport([linked], [incomingDune], "s1", { read: false });
eq(already.report[0].outcome, "already", "already in that series");
eq(already.update[0].data.coverImage, coverL, "…but a missing cover is filled");

const moved = planImport([standalone], [incomingLeft], "hain", { read: false });
eq(moved.report[0].outcome, "moved", "standalone moves into the series");
eq(moved.update[0].data.seriesId, "hain", "…and gets that series id");

const elsewhere = planImport([otherSeries], [incomingTowers], "hain", { read: false });
eq(elsewhere.report[0].outcome, "elsewhere", "a book in another series stays there");
eq(elsewhere.report[0].where, "The Lord of the Rings", "…and says where");
eq(elsewhere.update.some((u) => u.data.seriesId), false, "…without changing series");

const stay = planImport([standalone], [incomingLeft], null, { read: false });
eq(stay.report[0].outcome, "already", "already standalone, importing standalone again");
eq(stay.update[0].data.seriesId, undefined, "…without inventing a series");

const dup = planImport([], [incomingNew, incomingNew], null, { read: false });
eq(dup.create.length, 1, "the same work twice in one batch is one row");

eq(
  [incomingNew, incomingHobbit, incomingDune].sort(byYear).map((w) => w.year),
  [1937, 1965, 1997],
  "oldest first",
);
eq(
  byYear({ year: null, title: "A" }, { year: 1997, title: "B" }),
  1,
  "undated last",
);

console.log(`${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}

// ── stand-in speaking Open Library's documented search.json ─────────────────
import { createServer } from "node:http";

const stoneDoc = {
  key: "/works/OL82563W",
  title: "Harry Potter and the Philosopher's Stone",
  author_name: ["J. K. Rowling"],
  first_publish_year: 1997,
  cover_i: art,
  number_of_pages_median: 302,
};
const nopagesDoc = {
  key: "/works/OL1W",
  title: "A Poster Book",
  author_name: ["Anon"],
  first_publish_year: 2001,
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://stand-in.test");
  if (url.pathname !== "/search.json") {
    res.writeHead(404);
    res.end();
    return;
  }
  const q = url.searchParams.get("q") ?? "";
  if (q === "ratelimit") {
    res.writeHead(429);
    res.end();
    return;
  }
  if (q === "down") {
    res.writeHead(500);
    res.end("no");
    return;
  }
  if (req.headers["user-agent"]?.includes("MyPortal") !== true) {
    res.writeHead(403);
    res.end(JSON.stringify({ error: "no user-agent" }));
    return;
  }
  let docs = [];
  if (q === "harry potter" || q === "the philosopher") docs = [stoneDoc, nopagesDoc];
  else if (q === "isbn:9780439708180" || q === "key:/works/OL82563W") docs = [stoneDoc];
  else if (q === "key:/works/OL1W") docs = [nopagesDoc];
  else if (q === "key:/works/OL404W") docs = [];
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ docs, numFound: docs.length }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
process.env.OPENLIBRARY_BASE_URL = `http://127.0.0.1:${port}`;
const { searchWorks, workById, workDetails, OpenLibraryError } = await import("../lib/openlibrary-service.ts");

function assert(cond, label) {
  if (cond) pass++;
  else failures.push(label);
}

try {
  const found = await searchWorks("harry potter");
  eq(found.length, 2, "stand-in search returns both works");
  eq(found[0].id, "OL82563W", "…Philosopher's Stone first");
  eq(found[1].pages, null, "…a poster book has no pages");

  const byIsbn = await searchWorks("978-0-439-70818-0");
  eq(byIsbn.map((w) => w.id), ["OL82563W"], "ISBN lookup");

  const one = await workById("OL82563W");
  eq(one.pages, 302, "workById re-fetches the work");

  try {
    await workById("OL404W");
    assert(false, "missing work should 404");
  } catch (e) {
    assert(e instanceof OpenLibraryError && e.status === 404, "missing work is 404");
  }

  const details = await workDetails(["OL82563W", "OL1W", "OL404W"]);
  eq(details.works.map((w) => w.id), ["OL82563W"], "only works with pages are imported");
  eq(details.failed.map((f) => f.openLibraryId).sort(), ["OL1W", "OL404W"], "missing pages and missing works are reported");
  eq(details.failed.find((f) => f.openLibraryId === "OL1W").reason.includes("page count"), true, "no page count has a plain reason");

  try {
    await searchWorks("ratelimit");
    assert(false, "429 should throw");
  } catch (e) {
    assert(e instanceof OpenLibraryError && e.status === 429, "rate limit is 429, message has no URL");
    assert(!String(e.message).includes("127.0.0.1"), "the stand-in URL is not in the 429 message");
  }

  try {
    await searchWorks("down");
    assert(false, "500 should throw");
  } catch (e) {
    assert(e instanceof OpenLibraryError && e.status === 502, "Open Library 500 is a 502 to us");
    assert(!String(e.message).includes("127.0.0.1"), "the stand-in URL is not in the 502 message");
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(`${pass} passed, ${failures.length} failed (with stand-in)`);
if (failures.length) {
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
