// Importing from Comic Vine. Two things decide whether it can be trusted: issue numbers have to
// land in the right order (Comic Vine stores them as strings like "½" and "1.MU"), and an import
// must never touch what you have already marked — read, owned, your own names and covers.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-comicvine.mjs
import {
  parseIssueNumber, pickImage, isComicVineImage, titleNameFor, rankVolumes, planMerge,
} from "../lib/comicvine.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

// ── issue numbers ────────────────────────────────────────────────────────────
for (const [raw, want] of [
  ["1", 1], ["12", 12], ["441", 441], [" 7 ", 7], ["0", 0], ["-1", -1],
  ["1.5", 1.5], ["0.1", 0.1], ["½", 0.5], ["1/2", 0.5], ["1½", 1.5], ["-1½", -1.5],
]) eq(parseIssueNumber(raw), want, `"${raw}" is #${want}`);
for (const raw of ["", "   ", null, undefined, "1.MU", "Annual 1", "1a", "#1", "one", "1.", ".5", "1e3", "Infinity"]) {
  eq(parseIssueNumber(raw), null, `${JSON.stringify(raw)} is not a plain number`);
}
// Sorting by the parsed number puts every placeable issue in reading order.
const order = ["10", "-1", "½", "1", "1.5", "0", "2"].map(parseIssueNumber).sort((a, b) => a - b);
eq(order, [-1, 0, 0.5, 1, 1.5, 2, 10], "parsed numbers sort into reading order");

// ── covers ───────────────────────────────────────────────────────────────────
const art = "https://comicvine.gamespot.com/a/uploads/scale_medium/6/67663/2108437-01.jpg";
eq(pickImage({ medium_url: art, original_url: "https://comicvine.gamespot.com/a/uploads/original/x.jpg" }), art, "prefers the medium size");
eq(pickImage({ thumb_url: "https://comicvine.gamespot.com/a/uploads/scale_avatar/t.jpg" }),
  "https://comicvine.gamespot.com/a/uploads/scale_avatar/t.jpg", "falls back to any size there is");
eq(pickImage({ unexpected_key: art }), art, "an unforeseen field name still yields the cover");
eq(pickImage({ medium_url: "https://comicvine.gamespot.com/a/uploads/scale_medium/11122/6373148-blank.png" }), null,
  "Comic Vine's blank placeholder is not a cover");
eq(pickImage({ medium_url: "http://insecure.example/a.jpg" }), null, "plain http is refused");
eq(pickImage({ medium_url: "javascript:alert(1)" }), null, "only https URLs are ever stored");
eq(pickImage(null), null, "no image object, no cover");
eq(pickImage("https://comicvine.gamespot.com/a.jpg"), null, "a bare string is not the documented shape");
ok(isComicVineImage(art), "Comic Vine covers are recognised");
ok(isComicVineImage("https://static.comicvine.gamespot.com/a.jpg"), "…including a subdomain");
ok(!isComicVineImage("https://evilcomicvine.gamespot.com.attacker.io/a.jpg"), "a look-alike host is not Comic Vine");
ok(!isComicVineImage("https://xyz.supabase.co/storage/v1/object/public/covers/a.jpg"), "your own uploads are not");
ok(!isComicVineImage(null) && !isComicVineImage("not a url"), "nothing and junk are not");

// ── naming and ranking ───────────────────────────────────────────────────────
eq(titleNameFor({ name: "The Amazing Spider-Man", startYear: 1963 }), "The Amazing Spider-Man (1963)", "runs carry their year");
eq(titleNameFor({ name: "The Amazing Spider-Man", startYear: 2018 }), "The Amazing Spider-Man (2018)", "…so two runs never collide");
eq(titleNameFor({ name: "  Untitled  ", startYear: null }), "Untitled", "no year, no brackets");
const vols = [
  { id: 1, name: "Spider-Man", publisher: "Panini Comics" },
  { id: 2, name: "The Amazing Spider-Man", publisher: "Marvel" },
  { id: 3, name: "Spidey", publisher: null },
  { id: 4, name: "Spider-Man 2099", publisher: "Marvel Comics" },
];
eq(rankVolumes(vols, "Marvel").map((v) => v.id), [2, 4, 1, 3], "the current publisher's runs first, Comic Vine's order kept within");
eq(rankVolumes(vols, null).map((v) => v.id), [1, 2, 3, 4], "no publisher, no reordering");

// ── merging an import into what you have ─────────────────────────────────────
const cv = (n, name = null, image = null) => ({ id: Math.random(), issueNumber: n, name, image });
const fresh = planMerge([], [cv("2", "Duel"), cv("1", "Spider-Man!", art), cv("1.MU"), cv("½", "Prologue")]);
eq(fresh.create.map((c) => c.issueNumber), [0.5, 1, 2], "a new run is created in reading order");
eq(fresh.create[1], { issueNumber: 1, name: "Spider-Man!", coverImage: art }, "…with its name and cover");
eq(fresh.skipped, [{ issueNumber: "1.MU", reason: "not a plain issue number — add it by hand" }], "an unplaceable issue is reported, not dropped");

const mine = [
  { id: "a", issueNumber: 1, name: "My own name", coverImage: null },
  { id: "b", issueNumber: 2, name: null, coverImage: "https://xyz.supabase.co/storage/v1/object/public/covers/mine.jpg" },
  { id: "c", issueNumber: 3, name: "Kept", coverImage: "https://xyz.supabase.co/storage/v1/object/public/covers/c.jpg" },
];
const again = planMerge(mine, [cv("1", "CV name", art), cv("2", "CV two", art), cv("3", "CV three", art), cv("4", "New")]);
eq(again.create.map((c) => c.issueNumber), [4], "importing again only adds what is missing");
eq(again.fill, [{ id: "a", coverImage: art }, { id: "b", name: "CV two" }],
  "blanks get filled — your own name on #1 and your cover on #2 are left alone");
ok(!again.fill.some((f) => f.id === "c"), "an issue with nothing blank is not touched at all");
ok(again.fill.every((f) => Object.keys(f).every((k) => ["id", "name", "coverImage"].includes(k))),
  "an import can only ever write a name or a cover — never read, owned, rating, rereads or notes");

const dupes = planMerge([], [cv("1.1", "Point One"), cv("1.10", "Ten"), cv("5")]);
eq(dupes.create.map((c) => c.issueNumber), [1.1, 5], "the first of two numbers that collide is kept");
eq(dupes.skipped, [{ issueNumber: "1.10", reason: "same number as #1.1" }], "…and the second is reported");
eq(planMerge(mine, []).create.length + planMerge(mine, []).fill.length, 0, "an empty import changes nothing");
eq(planMerge([], [cv("1", "   ")]).create[0].name, null, "a blank name is stored as no name");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
