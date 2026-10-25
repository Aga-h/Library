// The floating back button's destinations. A wrong parent sends someone to a 404 or, worse,
// back onto the page they just left (the finances index and the old wardrobe paths redirect).
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-back-nav.mjs
import {
  applyNavigation,
  decideBack,
  normalizePath,
  parentFallback,
  parseTrail,
  referrerPath,
  restoreTrail,
  sameDestination,
  shouldShowFloatingBack,
  BACK_OVERFLOW_PX,
  BACK_SCROLL_PX,
} from "../lib/back-nav.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

const NOW = new Date("2026-10-25T12:00:00Z"); // 15:00 in Istanbul, still October
const MONTH_EDGE = new Date("2026-10-31T22:00:00Z"); // 01:00 on 1 Nov in Istanbul
const ORIGIN = "http://localhost:3000";

// ── paths ────────────────────────────────────────────────────────────────────

eq(normalizePath("/library/books/"), "/library/books", "a trailing slash is the same page");
eq(normalizePath("/library/books?q=dune"), "/library/books?q=dune", "search is kept");
eq(normalizePath("/library/books#notes"), "/library/books", "the hash is not a different page");
eq(normalizePath("//evil.com"), null, "a protocol-relative URL is not in-site");
eq(normalizePath("https://evil.com/library"), null, "an absolute URL is not in-site");
eq(normalizePath("http://portal.local/library"), null, "a full URL string is not accepted as a path");
eq(normalizePath("/library/books/../../shopping"), "/shopping", "dot segments resolve before the path is stored");
ok(!normalizePath(""), "empty is not a path");
eq(referrerPath("http://localhost:3000/library/books/", ORIGIN), "/library/books", "a same-origin referrer");
eq(referrerPath("https://google.com/search?q=x", ORIGIN), null, "another site is not a back target");
eq(referrerPath("http://localhost:3000//evil.com", ORIGIN), null, "a same-origin URL that is not a path");
ok(sameDestination("/library/books/", "/library/books"), "trailing slash matches");
ok(!sameDestination("/library/books", "/library/books?q=1"), "a different search is a different page");

// ── the parent each page's own arrow uses ───────────────────────────────────

const parents = [
  ["/library/books/abc", "/library/books"],
  ["/library/books/abc/edit", "/library/books/abc"],
  ["/library/books/new", "/library/books"],
  ["/library/books/new?seriesId=ser_1", "/library/books/s/ser_1"],
  ["/library/books/new?seriesId=../x", "/library/books"],
  ["/library/books/new?seriesId=https://evil.com", "/library/books"],
  ["/library/books/s/ser_1", "/library/books"],
  ["/library/books/s/ser_1/edit", "/library/books/s/ser_1"],
  ["/library/books/s/new", "/library/books"],
  ["/library/books/u/uni_1", "/library/books"],
  ["/library/books/u/uni_1/edit", "/library/books/u/uni_1"],
  ["/library/books/u/uni_1/new", "/library/books/u/uni_1"],
  ["/library/books/u/new", "/library/books"],
  ["/library/movies/new?universeId=uni_1", "/library/movies/u/uni_1"],
  ["/library/movies/new?universeId=uni/1", "/library/movies"],
  ["/library/movies/m1", "/library/movies"],
  ["/library/anime/import", "/library/anime/new"],
  ["/library/anime/new?seriesId=ser_1", "/library/anime/s/ser_1"],
  ["/library/anime/a1/edit", "/library/anime/a1"],
  ["/library/tv/new?seriesId=ser_1", "/library/tv/s/ser_1"],
  ["/library/tv/s/new", "/library/tv"],
  ["/library/tv/u/uni_1/new", "/library/tv/u/uni_1"],
  ["/library/comics/p/u/t/i", "/library/comics/p/u/t"],
  ["/library/comics/p/u/t/i/edit", "/library/comics/p/u/t/i"],
  ["/library/comics/p/u/t/new", "/library/comics/p/u/t"],
  ["/library/comics/p/u/new", "/library/comics/p/u"],
  ["/library/comics/p/s/new", "/library/comics/p/s"],
  ["/library/comics/p/new", "/library/comics/p"],
  ["/library/comics/new", "/library/comics"],
  ["/library/manga/m1", "/library/manga"],
  ["/library/manga/m1/edit", "/library/manga/m1"],
  ["/library/manga/import", "/library/manga"],
  ["/library/games/g1", "/library/games"],
  ["/library/games/new", "/library/games"],
  ["/library/articles/a1", "/library/articles"],
  ["/shopping/shop1", "/shopping"],
  ["/shopping/shop1/edit", "/shopping/shop1"],
  ["/shopping/new", "/shopping"],
  ["/shopping", "/"],
  ["/self-care/wardrobe/g1", "/self-care/wardrobe"],
  ["/self-care/wardrobe/g1/edit", "/self-care/wardrobe/g1"],
  ["/self-care/wardrobe/new", "/self-care/wardrobe"],
  ["/self-care/wardrobe", "/self-care"],
  ["/self-care", "/"],
  ["/study/sat-vocab/words", "/study/sat-vocab"],
  ["/study/sat-vocab/flashcards", "/study/sat-vocab"],
  ["/study/sat-vocab/quick", "/study/sat-vocab"],
  ["/study/sat-vocab", "/study"],
  ["/study/review?date=2026-10-24", "/study"],
  ["/study/modules", "/study"],
  ["/study", "/"],
  ["/library", "/"],
  ["/finances/2026/10", "/"],
  ["/finances", "/"],
  ["/", null],
  ["/login", null],
];
for (const [href, parent] of parents) {
  eq(parentFallback(href, NOW), parent, `parent of ${href}`);
  if (parent) ok(parent !== href.split("?")[0] && parent !== href, `${href} does not fall back to itself`);
}
eq(parentFallback("/finances/log", NOW), "/finances/2026/10", "the logger's arrow goes to this month");
eq(parentFallback("/finances/log", MONTH_EDGE), "/finances/2026/11", "the month is Istanbul's, not UTC's");

// A direct open uses the parent, never history, and never the external site it came from.
let trail = restoreTrail(null, "/library/books/abc", "https://google.com/", ORIGIN);
eq(trail, { entries: ["/library/books/abc"], index: 0, depth: 0 }, "an external referrer starts a fresh trail");
eq(decideBack(trail, "/library/books/abc", NOW), { type: "href", href: "/library/books" }, "direct open falls back to the section");

// Climbing keeps climbing. The second press must not return to the page just left.
trail = applyNavigation(trail, "/library/books", "fallback");
eq(decideBack(trail, "/library/books", NOW), { type: "href", href: "/library" }, "the next press climbs to the library");
trail = applyNavigation(trail, "/library", "fallback");
eq(decideBack(trail, "/library", NOW), { type: "href", href: "/" }, "the library climbs to the portal");
trail = applyNavigation(trail, "/", "fallback");
eq(decideBack(trail, "/", NOW), { type: "none" }, "the portal has nowhere further to go");

// In-site history wins over the parent, and a refresh keeps it.
trail = restoreTrail(null, "/", null, ORIGIN);
trail = applyNavigation(trail, "/library", "push");
trail = applyNavigation(trail, "/library/books", "push");
trail = applyNavigation(trail, "/library/books/abc", "push");
eq(trail.depth, 3, "three in-site steps");
eq(decideBack(trail, "/library/books/abc", NOW), { type: "history" }, "arrived from the books list, so step back");
const refreshed = restoreTrail(trail, "/library/books/abc", "https://google.com/", ORIGIN);
eq(refreshed, trail, "a refresh keeps the trail even when the referrer is external");
eq(decideBack(refreshed, "/library/books/abc", NOW), { type: "history" }, "after a refresh the previous page is still in history");

// A filter replaces the entry. Back still goes to the page before the list, once.
trail = applyNavigation(trail, "/library/books", "pop");
trail = applyNavigation(trail, "/library/books?q=dune", "replace");
eq(trail.entries, ["/", "/library", "/library/books?q=dune", "/library/books/abc"], "replace edits the current page and leaves the forward one");
eq(trail.index, 2, "the filtered list is the current page");
eq(trail.depth, 2, "replace does not add a history step");
eq(decideBack(trail, "/library/books?q=dune", NOW), { type: "history" }, "back from a filtered list is one step");

// Review dates are real visits: back returns to the day you came from, not to Study.
trail = restoreTrail(null, "/study", null, ORIGIN);
trail = applyNavigation(trail, "/study/review", "push");
trail = applyNavigation(trail, "/study/review?date=2026-10-24", "push");
eq(decideBack(trail, "/study/review?date=2026-10-24", NOW), { type: "history" }, "the previous review day is the previous page");

// `/finances` redirects to the current month. Stepping onto it from that month loops.
trail = restoreTrail(null, "/", null, ORIGIN);
trail = applyNavigation(trail, "/finances", "push");
trail = applyNavigation(trail, "/finances/2026/10", "push");
eq(decideBack(trail, "/finances/2026/10", NOW), { type: "href", href: "/" }, "skip the finances index, it redirects back here");

// An old wardrobe path does the same.
trail = restoreTrail(null, "/", null, ORIGIN);
trail = applyNavigation(trail, "/wardrobe", "push");
trail = applyNavigation(trail, "/self-care/wardrobe", "push");
eq(decideBack(trail, "/self-care/wardrobe", NOW), { type: "href", href: "/" }, "skip /wardrobe, it redirects back here");

// Login bounces a signed-out session straight back. Don't offer it.
trail = applyNavigation(restoreTrail(null, "/library", null, ORIGIN), "/login", "push");
eq(decideBack(trail, "/login", NOW), { type: "none" }, "login is not a back target");

// Depth zero means the browser's previous entry is not one of ours, even if a stale trail says so.
trail = { entries: ["/", "/library/books/abc"], index: 1, depth: 0 };
eq(decideBack(trail, "/library/books/abc", NOW), { type: "href", href: "/library/books" }, "no in-site history steps uses the parent");

// A full navigation that continues from the page this tab already had open.
const stored = { entries: ["/", "/library/books"], index: 1, depth: 1 };
trail = restoreTrail(stored, "/library/books/abc", "http://localhost:3000/library/books", ORIGIN);
eq(trail.entries, ["/", "/library/books", "/library/books/abc"], "a same-site referrer continues the trail");
eq(trail.depth, 2, "that full load is one more in-site step");

// The same load from another site drops the stale trail.
trail = restoreTrail(stored, "/library/books/abc", "https://google.com/", ORIGIN);
eq(trail, { entries: ["/library/books/abc"], index: 0, depth: 0 }, "external referrer drops a trail for a different page");

// Pop back, then forward, then somewhere unknown.
trail = { entries: ["/", "/library", "/library/books"], index: 2, depth: 2 };
trail = applyNavigation(trail, "/library", "pop");
eq(trail, { entries: ["/", "/library", "/library/books"], index: 1, depth: 1 }, "back lands on the library and keeps the forward page");
trail = applyNavigation(trail, "/library/books", "pop");
eq(trail.index, 2, "forward returns to the books list");
eq(trail.depth, 2, "forward restores the in-site depth");
trail = applyNavigation(trail, "/shopping", "pop");
eq(trail, { entries: ["/shopping"], index: 0, depth: 0 }, "a page the trail doesn't know starts fresh");

// A stored trail that has been tampered with.
eq(parseTrail("{"), null, "broken JSON is ignored");
eq(parseTrail(JSON.stringify({ entries: ["https://evil.com"], index: 0, depth: 1 })), null, "an external entry is rejected");
eq(parseTrail(JSON.stringify({ entries: ["/library"], index: 0, depth: 9 })), { entries: ["/library"], index: 0, depth: 0 }, "depth can't outrun the pages behind this one");
eq(parseTrail(null), null, "no stored trail");

// The trail doesn't grow without bound. Depth stays inside what was kept.
trail = restoreTrail(null, "/", null, ORIGIN);
for (let i = 0; i < 50; i++) trail = applyNavigation(trail, `/library/books?n=${i}`, "push");
ok(trail.entries.length <= 40, "the trail keeps at most 40 pages");
ok(trail.depth <= trail.index, "depth stays within the pages still recorded");
eq(trail.entries[trail.index], "/library/books?n=49", "the newest page is current");
eq(decideBack(trail, "/library/books?n=49", NOW).type, "history", "a long session still steps back one page");

// ── when the button is on screen ────────────────────────────────────────────

ok(!shouldShowFloatingBack(0, 2000, true, false), "at the top the page's own arrow is still there");
ok(!shouldShowFloatingBack(BACK_SCROLL_PX, 2000, true, false), "just at the threshold the arrow is still in reach");
ok(shouldShowFloatingBack(BACK_SCROLL_PX + 1, 2000, true, false), "once that arrow has scrolled away, the button shows");
ok(!shouldShowFloatingBack(800, BACK_OVERFLOW_PX, true, false), "a short page never grows a second back control");
ok(!shouldShowFloatingBack(800, 2000, false, false), "nowhere to go, no button");
ok(!shouldShowFloatingBack(800, 2000, true, true), "a drawer or sheet covers the corner, so the button hides");

if (failures.length) {
  console.error(`${failures.length} failed, ${pass} passed\n`);
  for (const failure of failures) console.error(`FAIL ${failure}\n`);
  process.exit(1);
}
console.log(`${pass} passed`);
