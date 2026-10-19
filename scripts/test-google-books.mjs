// Google Books as the second book catalogue. Volume ids, covers from books.google.com, collapsing
// edition soup by title + author, merging with Open Library, and matching a library row that
// already has the other catalogue's id so the two never duplicate.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-google-books.mjs
import {
  googleVolumeIdOf, googleSearchQueryOf, googleCoverUrl, isGoogleBooksImage, yearFromDate,
  toVolume, fromGbVolume, combineSources, sameWork, dedupeVolumes, mergeCatalog, GB_IMAGE_HOSTS,
} from "../lib/google-books.ts";
import { matchExisting, planImport, toWork, OL_IMAGE_HOST } from "../lib/openlibrary.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) {
  if (cond) pass++; else failures.push(label);
}

const gbId = "_ojXNuzgHRcC";
const coverFull = `https://books.google.com/books/content?id=${encodeURIComponent(gbId)}&printsec=frontcover&img=1&zoom=1&source=gbs_api`;
const coverThumb = `https://books.google.com/books/content?id=${encodeURIComponent(gbId)}&printsec=frontcover&img=1&zoom=5&source=gbs_api`;

const raw = (over = {}, infoOver = {}) => ({
  id: gbId,
  volumeInfo: {
    title: "Piranesi",
    authors: ["Susanna Clarke"],
    publisher: "Bloomsbury",
    publishedDate: "2020-09-15",
    pageCount: 272,
    imageLinks: { thumbnail: "http://books.google.com/books/content?id=x&zoom=5" },
    ...infoOver,
  },
  ...over,
});

// ── ids and search query ─────────────────────────────────────────────────────
eq(googleVolumeIdOf(gbId), gbId, "bare volume id");
eq(googleVolumeIdOf(`https://books.google.com/books?id=${gbId}`), gbId, "books.google.com ?id=");
eq(googleVolumeIdOf(`https://www.googleapis.com/books/v1/volumes/${gbId}`), gbId, "API volumes URL");
eq(googleVolumeIdOf("OL82563W"), null, "an Open Library work id is not a Google volume");
eq(googleVolumeIdOf("9780439708180"), null, "an ISBN is not a Google volume id");
eq(googleVolumeIdOf(""), null, "empty: unusable");
eq(googleVolumeIdOf("short"), null, "too short");
eq(googleSearchQueryOf("piranesi"), { kind: "text", value: "piranesi" }, "words pass through");
eq(googleSearchQueryOf("978-0-439-70818-0"), { kind: "isbn", value: "9780439708180" }, "an ISBN is isbn:");
eq(googleSearchQueryOf(`https://books.google.com/books?id=${gbId}`), { kind: "id", value: gbId }, "a volume URL is looked up by id");
eq(googleSearchQueryOf(gbId), { kind: "text", value: gbId }, "a bare id-shaped token stays a title search");

// ── covers ───────────────────────────────────────────────────────────────────
eq(googleCoverUrl(gbId), coverFull, "stored cover is zoom=1 on books.google.com");
eq(googleCoverUrl(gbId, "thumb"), coverThumb, "…thumbnail is zoom=5");
ok(isGoogleBooksImage(coverFull), "Google Books covers are recognised");
ok(isGoogleBooksImage("https://books.googleusercontent.com/books/content?id=x"), "googleusercontent host too");
ok(!isGoogleBooksImage("https://books.google.com.attacker.io/x"), "a look-alike host is not Google Books");
ok(!isGoogleBooksImage(`https://${OL_IMAGE_HOST}/b/id/1-L.jpg`), "an Open Library cover is not Google Books");
eq(GB_IMAGE_HOSTS.includes("books.google.com"), true, "primary host listed for mirroring skip");

// ── reading Google's answer ──────────────────────────────────────────────────
const piranesi = toVolume(raw());
eq(piranesi, {
  id: gbId, title: "Piranesi", author: "Susanna Clarke", year: 2020, pages: 272,
  cover: coverFull, coverThumb, publisher: "Bloomsbury", language: null,
}, "a volume document");
eq(toVolume(raw({}, { authors: ["Susanna Clarke", "Someone"] })).author, "Susanna Clarke, Someone", "several authors");
eq(toVolume(raw({}, { authors: undefined })).author, "Unknown", "missing authors");
eq(toVolume(raw({}, { pageCount: 0 })).pages, null, "0 pages means unknown");
eq(toVolume(raw({}, { imageLinks: undefined })).cover, null, "no imageLinks: no cover (placeholder refused)");
eq(toVolume(raw({}, { publishedDate: "2020" })).year, 2020, "year-only date");
eq(toVolume(raw({}, { publishedDate: "2020-09" })).year, 2020, "year-month date");
eq(yearFromDate("1997-06-26"), 1997, "full date");
eq(yearFromDate(1997), 1997, "a number year");
eq(toVolume({ volumeInfo: { title: "x" } }), null, "no id: unusable");
eq(toVolume(raw({ id: gbId }, { title: "" })), null, "no title: unusable");
eq(fromGbVolume(piranesi).id, `gb:${gbId}`, "Google-only catalogue id is gb: prefixed");
eq(fromGbVolume(piranesi).openLibraryId, null, "…no Open Library id");
eq(fromGbVolume(piranesi).googleBooksId, gbId, "…keeps the volume id");

const olPiranesi = toWork({
  key: "/works/OL28154936W", title: "Piranesi", author_name: ["Susanna Clarke"],
  first_publish_year: 2020, cover_i: 15155833, number_of_pages_median: 245,
});
const combined = combineSources(olPiranesi, piranesi);
eq(combined.id, "OL28154936W", "merged row keeps the Open Library id as its key");
eq(combined.googleBooksId, gbId, "…and the Google Books id");
eq(combined.pages, 245, "Open Library page median wins when both have pages");
eq(combined.publisher, "Bloomsbury", "publisher comes from Google Books");
eq(combined.cover.startsWith("https://covers.openlibrary.org"), true, "Open Library cover wins");

const olNoPages = toWork({
  key: "/works/OL1W", title: "Piranesi", author_name: ["Susanna Clarke"], first_publish_year: 2020,
});
eq(combineSources(olNoPages, piranesi).pages, 272, "Google Books fills a missing page count");
eq(combineSources(null, piranesi).id, `gb:${gbId}`, "Google-only when Open Library missed it");
eq(combineSources(olPiranesi, null).googleBooksId, null, "Open Library-only when Google missed it");
eq(combineSources(null, null), null, "neither source: nothing");

ok(sameWork(olPiranesi, piranesi), "same title and author: same work");
ok(sameWork({ title: "Piranesi", author: "Susanna Clarke" }, { title: "Piranesi: A Novel", author: "S. Clarke" }) === false, "different normalised author: not merged");
ok(sameWork({ title: "Piranesi", author: "Susanna Clarke" }, { title: "Piranesi: A Novel", author: "Susanna Clarke" }), "subtitle does not split a search hit");
ok(!sameWork({ title: "The Hobbit", author: "J.R.R. Tolkien" }, { title: "The Lord of the Rings", author: "J.R.R. Tolkien" }), "different titles: not merged");

const ed1 = { ...piranesi, id: "AAAAAAAAAAAA", pages: null, cover: null };
const ed2 = { ...piranesi, id: "BBBBBBBBBBBB", pages: 300, cover: coverFull };
const ed3 = { ...piranesi, id: "CCCCCCCCCCCC", pages: 272, cover: coverFull };
eq(dedupeVolumes([ed1, ed2, ed3]).map((v) => v.id), ["BBBBBBBBBBBB"], "edition soup: keep the one with pages");
eq(dedupeVolumes([ed1, { ...ed1, id: "DDDDDDDDDDDD", cover: coverFull }]).map((v) => v.id), ["DDDDDDDDDDDD"], "…or the one with a cover if none have pages");

const olStone = toWork({
  key: "/works/OL82563W", title: "Harry Potter and the Philosopher's Stone",
  author_name: ["J. K. Rowling"], first_publish_year: 1997, number_of_pages_median: 302, cover_i: 1,
});
const gbOnly = toVolume(raw({ id: "zyTCAlFPjgYC" }, { title: "A Missing Novel", authors: ["Pat"] }));
const merged = mergeCatalog([olStone], [piranesi, gbOnly], "a missing novel");
eq(merged[0].title, "A Missing Novel", "a Google-only hit matching the query is listed first");
eq(merged[1].id, "OL82563W", "…then Open Library's order");
ok(merged.some((w) => w.title === "Piranesi"), "unrelated Google-only hits still appear after");
const withPiranesi = mergeCatalog([olPiranesi], [piranesi], "piranesi");
eq(withPiranesi.length, 1, "the same novel from both catalogues is one row");
eq(withPiranesi[0].openLibraryId, "OL28154936W", "…Open Library id kept");
eq(withPiranesi[0].googleBooksId, gbId, "…Google Books id attached");

const olListed = mergeCatalog([olStone], [gbOnly], "harry potter");
eq(olListed[0].id, "OL82563W", "a query that matches Open Library does not bury it under Google-only extras");
eq(olListed.some((w) => w.googleBooksId === "zyTCAlFPjgYC"), true, "…Google-only extras still appear after");

const mushokuQuery = "Mushoku Tensei: Jobless Reincarnation (Light Novel) Vol. 1";
const olMushoku = toWork({
  key: "/works/OL20094984W",
  title: "無職転生 ~異世界行ったら本気だす~ 1 (light novel)",
  author_name: ["理不尽な孫の手"],
  first_publish_year: 2014,
  number_of_pages_median: 320,
});
const gbMushoku = toVolume(raw({ id: "mushokutense1" }, {
  title: mushokuQuery, authors: ["Rifujin na Magonote"], publisher: "Seven Seas", pageCount: 320,
  imageLinks: { thumbnail: "http://x" }, language: "en",
}));
const mushokuHits = mergeCatalog([olMushoku], [gbMushoku], mushokuQuery);
eq(mushokuHits[0].title, mushokuQuery, "English Mushoku Tensei is listed before 無職転生");
ok(!mushokuHits[0].title.includes("無職"), "the first hit is not the Japanese work title");
eq(combineSources(olMushoku, gbMushoku, mushokuQuery).title, mushokuQuery,
  "merging prefers the English title when that is what was searched");

eq(mergeCatalog([olNoPages], []).length, 0, "Open Library-only with no pages is omitted from search");
eq(mergeCatalog([], [{ ...piranesi, pages: null }]).length, 0, "Google-only with no pages is omitted from search");
const filledPages = mergeCatalog([olNoPages], [piranesi], "piranesi");
eq(filledPages.length, 1, "…unless the other catalogue has a page count");
eq(filledPages[0].pages, 272, "…filled from Google Books");
eq(filledPages[0].openLibraryId, "OL1W", "…Open Library id kept on the filled row");
eq(mergeCatalog([olNoPages], [{ ...piranesi, pages: null }]).length, 0,
  "the same novel with no pages on either side is omitted");

// ── already in the library: the other catalogue must not duplicate ───────────
const library = [
  {
    id: "ol-row", title: "Piranesi", author: "Susanna Clarke", openLibraryId: "OL28154936W",
    googleBooksId: null, publisher: null, pages: 245, coverImage: null, seriesId: null, seriesName: null,
  },
  {
    id: "hand", title: "the hobbit", author: "J.R.R. Tolkien", openLibraryId: null,
    googleBooksId: null, publisher: "Allen & Unwin", pages: 310, coverImage: "mine.jpg", seriesId: null, seriesName: null,
  },
];
eq(matchExisting(fromGbVolume(piranesi), library)?.id, "ol-row",
  "Google Books of a book already linked to Open Library matches that row");
eq(matchExisting(olPiranesi, library)?.id, "ol-row", "Open Library id still matches");

const gbHobbit = toVolume(raw({ id: "hobbitvolume1" }, {
  title: "The Hobbit", authors: ["J.R.R. Tolkien"], publisher: "HarperCollins", pageCount: 310,
  imageLinks: { thumbnail: "http://x" },
}));
eq(matchExisting(fromGbVolume(gbHobbit), library)?.id, "hand", "a hand-added row still matches Google Books by title + author");

const gbPlan = planImport(library, [{ ...fromGbVolume(piranesi), pages: 272 }], null, { read: false });
eq(gbPlan.create.length, 0, "does not add a second Piranesi");
eq(gbPlan.update[0].data.googleBooksId, gbId, "…attaches the Google Books id");
eq(gbPlan.update[0].data.openLibraryId, undefined, "…does not touch the Open Library id");
eq(gbPlan.report[0].outcome, "linked", "…reported as linked");
eq("pages" in (gbPlan.update[0].data), false, "your page count stays");
eq(gbPlan.update[0].data.publisher, "Bloomsbury", "a blank publisher is filled from Google Books");

const newGb = planImport([], [{ ...fromGbVolume(piranesi), pages: 272 }], null, { read: true });
eq(newGb.create[0], {
  title: "Piranesi", author: "Susanna Clarke", pages: 272, pagesRead: 272,
  coverImage: coverFull, publisher: "Bloomsbury", openLibraryId: null, googleBooksId: gbId,
}, "a Google-only new row, marked read");

console.log(`${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}

// ── stand-in speaking Google Books' documented volumes API ───────────────────
import { createServer } from "node:http";

const piranesiDoc = {
  id: gbId,
  volumeInfo: {
    title: "Piranesi",
    authors: ["Susanna Clarke"],
    publisher: "Bloomsbury",
    publishedDate: "2020-09-15",
    pageCount: 272,
    imageLinks: { thumbnail: "http://books.google.com/x" },
  },
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://stand-in.test");
  if (url.searchParams.get("key") === "bad") {
    res.writeHead(403);
    res.end(JSON.stringify({ error: { code: 403, message: "forbidden" } }));
    return;
  }
  if (url.pathname === "/volumes" && (url.searchParams.get("q") ?? "").includes("ratelimit")) {
    res.writeHead(429);
    res.end(JSON.stringify({ error: { code: 429, message: "quota" } }));
    return;
  }
  if (url.pathname === "/volumes" && (url.searchParams.get("q") ?? "") === "down") {
    res.writeHead(500);
    res.end("no");
    return;
  }
  if (url.pathname === `/volumes/${gbId}`) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(piranesiDoc));
    return;
  }
  if (url.pathname.startsWith("/volumes/") && url.pathname !== "/volumes") {
    res.writeHead(404);
    res.end(JSON.stringify({ error: { code: 404, message: "not found" } }));
    return;
  }
  if (url.pathname !== "/volumes") {
    res.writeHead(404);
    res.end();
    return;
  }
  const q = url.searchParams.get("q") ?? "";
  let items = [];
  if (q.toLowerCase().includes("piranesi") || q === `isbn:9781635575644`) items = [piranesiDoc];
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ items, totalItems: items.length }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
process.env.GOOGLE_BOOKS_BASE_URL = `http://127.0.0.1:${port}`;
delete process.env.GOOGLE_BOOKS_API_KEY;
const { searchVolumes, volumeById, GoogleBooksError } = await import("../lib/google-books-service.ts");

function assert(cond, label) {
  if (cond) pass++;
  else failures.push(label);
}

try {
  const found = await searchVolumes("piranesi");
  eq(found.length, 1, "stand-in search returns the volume");
  eq(found[0].id, gbId, "…Piranesi");
  eq(found[0].publisher, "Bloomsbury", "…publisher");

  const byIsbn = await searchVolumes("978-1-63557-564-4");
  eq(byIsbn.map((v) => v.id), [gbId], "ISBN lookup");

  const one = await volumeById(gbId);
  eq(one.pages, 272, "volumeById re-fetches the volume");

  try {
    await volumeById("zzzzzzzzzzzz");
    assert(false, "missing volume should 404");
  } catch (e) {
    assert(e instanceof GoogleBooksError && e.status === 404, "missing volume is 404");
  }

  try {
    await searchVolumes("ratelimit");
    assert(false, "429 should throw");
  } catch (e) {
    assert(e instanceof GoogleBooksError && e.status === 429, "rate limit is 429");
    assert(String(e.message).includes("GOOGLE_BOOKS_API_KEY"), "no-key 429 mentions the env var");
    assert(!String(e.message).includes("127.0.0.1"), "the stand-in URL is not in the 429 message");
  }

  try {
    await searchVolumes("down");
    assert(false, "500 should throw");
  } catch (e) {
    assert(e instanceof GoogleBooksError && e.status === 502, "Google Books 500 is a 502 to us");
    assert(!String(e.message).includes("127.0.0.1"), "the stand-in URL is not in the 502 message");
  }

  process.env.GOOGLE_BOOKS_API_KEY = "bad";
  // Re-import would cache the module; apiKey() reads env each call, so a 403 with a key set
  // takes the "check GOOGLE_BOOKS_API_KEY" branch.
  try {
    await searchVolumes("piranesi");
    assert(false, "bad key should 403");
  } catch (e) {
    assert(e instanceof GoogleBooksError && e.status === 403, "forbidden is 403");
    assert(String(e.message).includes("check GOOGLE_BOOKS_API_KEY"), "bad key names the env var");
    assert(!String(e.message).includes("bad"), "the key itself is not in the message");
  }
} finally {
  delete process.env.GOOGLE_BOOKS_API_KEY;
  await new Promise((resolve) => server.close(resolve));
}

console.log(`${pass} passed, ${failures.length} failed (with stand-in)`);
if (failures.length) {
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}

// ── combined search: Google Books 429 must not hide Open Library ─────────────
const olDoc = {
  key: "/works/OL82563W",
  title: "Harry Potter and the Philosopher's Stone",
  author_name: ["J. K. Rowling"],
  first_publish_year: 1997,
  cover_i: 1,
  number_of_pages_median: 302,
};
const olServer = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://stand-in.test");
  if (url.pathname !== "/search.json") {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ docs: [olDoc], numFound: 1 }));
});
const gbDown = createServer((req, res) => {
  res.writeHead(429);
  res.end(JSON.stringify({ error: { code: 429 } }));
});
await new Promise((resolve) => olServer.listen(0, "127.0.0.1", resolve));
await new Promise((resolve) => gbDown.listen(0, "127.0.0.1", resolve));
process.env.OPENLIBRARY_BASE_URL = `http://127.0.0.1:${olServer.address().port}`;
process.env.GOOGLE_BOOKS_BASE_URL = `http://127.0.0.1:${gbDown.address().port}`;

try {
  const { searchCatalog } = await import("../lib/book-catalog-service.ts");
  const { searchWorks } = await import("../lib/openlibrary-service.ts");
  const olOnly = await searchWorks("harry potter");
  eq(olOnly[0].id, "OL82563W", "Open Library stand-in still answers");
  const both = await searchCatalog("harry potter");
  eq(both.works[0].id, "OL82563W", "combined search still returns Open Library when Google Books 429s");
  ok(typeof both.notice === "string" && both.notice.length > 0, "…and explains that Google Books was limited");
  assert(!both.notice.includes("127.0.0.1"), "the notice has no stand-in URL");
} finally {
  await new Promise((resolve) => olServer.close(resolve));
  await new Promise((resolve) => gbDown.close(resolve));
}

console.log(`${pass} passed, ${failures.length} failed (combined search)`);
if (failures.length) {
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
