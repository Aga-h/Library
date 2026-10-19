// Google Books as the book catalogue. Volume ids, covers from books.google.com, collapsing
// edition soup by title + author, and matching a library row that already has an Open Library
// id so the two never duplicate.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-google-books.mjs
import {
  googleVolumeIdOf, googleSearchQueryOf, googleCoverUrl, isGoogleBooksImage, yearFromDate,
  toVolume, fromGbVolume, sameWork, dedupeVolumes, catalogFromVolumes, GB_IMAGE_HOSTS,
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
  cover: coverFull, coverThumb, publisher: "Bloomsbury", language: null, ebook: false,
}, "a volume document");
eq(toVolume(raw({ saleInfo: { isEbook: true } })).ebook, true, "saleInfo.isEbook marks an ebook");
eq(toVolume(raw({}, { subtitle: "Kindle Edition" })).ebook, true, "Kindle in the subtitle is an ebook");
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

ok(sameWork(olPiranesi, piranesi), "same title and author: same work");
ok(sameWork({ title: "Piranesi", author: "Susanna Clarke" }, { title: "Piranesi: A Novel", author: "S. Clarke" }) === false, "different normalised author: not merged");
ok(sameWork({ title: "Piranesi", author: "Susanna Clarke" }, { title: "Piranesi: A Novel", author: "Susanna Clarke" }), "subtitle does not split a search hit");
ok(!sameWork({ title: "The Hobbit", author: "J.R.R. Tolkien" }, { title: "The Lord of the Rings", author: "J.R.R. Tolkien" }), "different titles: not merged");
ok(!sameWork(
  { title: "Mushoku Tensei: Jobless Reincarnation (Light Novel) Vol. 1", author: "Rifujin na Magonote" },
  { title: "Mushoku Tensei: Jobless Reincarnation (Light Novel) Vol. 2", author: "Rifujin na Magonote" },
), "volumes of a series are not the same work");
ok(!sameWork(
  { title: "Mushoku Tensei: Jobless Reincarnation (Light Novel) Vol. 1", author: "Rifujin na Magonote" },
  { title: "Mushoku Tensei: Jobless Reincarnation Vol. 1", author: "Rifujin na Magonote" },
), "the light novel is not the manga");

const ed1 = { ...piranesi, id: "AAAAAAAAAAAA", pages: null, cover: null };
const ed2 = { ...piranesi, id: "BBBBBBBBBBBB", pages: 300, cover: coverFull };
const ed3 = { ...piranesi, id: "CCCCCCCCCCCC", pages: 272, cover: coverFull };
eq(dedupeVolumes([ed1, ed2, ed3]).map((v) => v.id), ["BBBBBBBBBBBB"], "edition soup: keep the one with pages");
eq(dedupeVolumes([ed1, { ...ed1, id: "DDDDDDDDDDDD", cover: coverFull }]).map((v) => v.id), ["DDDDDDDDDDDD"], "…or the one with a cover if none have pages");
eq(
  dedupeVolumes([piranesi, { ...piranesi, id: "subtitlevol001", title: "Piranesi: A Novel" }]).map((v) => v.id),
  [gbId],
  "a subtitle does not split edition soup",
);
const kindle = { ...piranesi, id: "kindlevolume1", pages: 267, ebook: true };
const print = { ...piranesi, id: "printvolume01", pages: 320, ebook: false };
eq(dedupeVolumes([kindle, print]).map((v) => v.id), ["printvolume01"], "print edition beats the Kindle listing of the same novel");
eq(catalogFromVolumes([kindle, print], "piranesi")[0].pages, 320, "…search lists the print page count");
eq(dedupeVolumes([kindle, { ...print, pages: null }]).map((v) => v.id), ["kindlevolume1"], "ebook with pages beats print without");
eq(
  dedupeVolumes([
    { ...piranesi, id: "kindlevolume1", pages: 267, ebook: true },
    { ...piranesi, id: "playvolume001", pages: 320, ebook: true },
  ]).map((v) => v.id),
  ["playvolume001"],
  "when Google marks both as ebooks, the higher page count wins",
);
eq(
  catalogFromVolumes([
    { ...piranesi, id: "kindlevolume1", title: "Piranesi: A Novel", pages: 267, ebook: true },
    { ...piranesi, id: "printvolume01", title: "Piranesi", pages: 320, ebook: true },
  ], "Piranesi: A Novel")[0].pages,
  320,
  "more pages win even when the Kindle title fits the query better",
);

const gbOnly = toVolume(raw({ id: "zyTCAlFPjgYC" }, { title: "A Missing Novel", authors: ["Pat"] }));
const listed = catalogFromVolumes([piranesi, gbOnly], "a missing novel");
eq(listed[0].title, "A Missing Novel", "a hit matching the query is listed first");
eq(listed[1].googleBooksId, gbId, "…then Google's remaining order");
eq(catalogFromVolumes([piranesi], "piranesi").length, 1, "one novel is one row");
eq(catalogFromVolumes([{ ...piranesi, pages: null }]).length, 0, "no page count is omitted from search");

const mushokuQuery = "Mushoku Tensei: Jobless Reincarnation (Light Novel) Vol. 1";
const gbMushokuJp = toVolume(raw({ id: "mushokutensej" }, {
  title: "無職転生 ~異世界行ったら本気だす~ 1 (light novel)", authors: ["Rifujin na Magonote"],
  pageCount: 320, imageLinks: { thumbnail: "http://x" },
}));
const gbMushoku = toVolume(raw({ id: "mushokutense1" }, {
  title: mushokuQuery, authors: ["Rifujin na Magonote"], publisher: "Seven Seas", pageCount: 320,
  imageLinks: { thumbnail: "http://x" }, language: "en",
}));
const mushokuHits = catalogFromVolumes([gbMushokuJp, gbMushoku], mushokuQuery);
eq(mushokuHits[0].title, mushokuQuery, "English Mushoku Tensei is listed before 無職転生");
ok(!mushokuHits[0].title.includes("無職"), "the first hit is not the Japanese title");

const mushokuKindle = toVolume(raw({ id: "mushokukindle", saleInfo: { isEbook: true } }, {
  title: mushokuQuery, authors: ["Rifujin na Magonote"], publisher: "Seven Seas", pageCount: 267,
  imageLinks: { thumbnail: "http://x" }, language: "en",
}));
const mushokuPrint = toVolume(raw({ id: "mushokuprint1", saleInfo: { isEbook: false } }, {
  title: mushokuQuery, authors: ["Rifujin na Magonote"], publisher: "Seven Seas", pageCount: 320,
  imageLinks: { thumbnail: "http://x" }, language: "en",
}));
eq(catalogFromVolumes([mushokuKindle, mushokuPrint], mushokuQuery)[0].pages, 320,
  "Mushoku Tensei Vol. 1 uses the print page count, not the Kindle 267");
eq(catalogFromVolumes([mushokuKindle, mushokuPrint], mushokuQuery)[0].googleBooksId, "mushokuprint1",
  "…and keeps the print volume id");

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
  const { searchCatalog } = await import("../lib/book-catalog-service.ts");

function assert(cond, label) {
  if (cond) pass++;
  else failures.push(label);
}

try {
  const found = await searchVolumes("piranesi");
  eq(found.length, 1, "stand-in search returns the volume");
  eq(found[0].id, gbId, "…Piranesi");
  eq(found[0].publisher, "Bloomsbury", "…publisher");

  const catalog = await searchCatalog("piranesi");
  eq(catalog.works.map((w) => w.googleBooksId), [gbId], "searchCatalog is Google Books only");
  eq(catalog.works[0].pages, 272, "…and drops nothing that has pages");

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
    await searchCatalog("ratelimit");
    assert(false, "429 should throw");
  } catch (e) {
    assert(e instanceof GoogleBooksError && e.status === 429, "searchCatalog fails when Google Books 429s");
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
