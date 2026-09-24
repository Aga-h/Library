// SAT vocabulary: reading a pasted list, and building a test whose questions have exactly one
// correct answer. Both are pure, and both decide whether the test is right or quietly wrong.
//
// Run: node --experimental-strip-types scripts/test-vocab.mjs
import { parseWordList, buildQuestions, shuffle, OPTIONS_PER_QUESTION } from "../lib/vocab.ts";
import { SAT_VOCAB_LIST, SAT_VOCAB_WORD_COUNT } from "../lib/sat-vocab-list.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

// ── separators ───────────────────────────────────────────────────────────────
const seps = parseWordList([
  "abate — to lessen in intensity",
  "aberrant – deviating from the norm",
  "abscond: to depart secretly",
  "abstain\tto refrain from",
  "accolade - an award or honour",
].join("\n"));
eq(seps.words.map((w) => w.word), ["abate", "aberrant", "abscond", "abstain", "accolade"], "every separator form");
eq(seps.skipped, [], "nothing skipped");

// A hyphenated word must not be split on its own hyphen.
const hyphen = parseWordList("self-effacing — modest about oneself");
eq(hyphen.words[0].word, "self-effacing", "hyphenated word survives");
eq(hyphen.words[0].meanings, ["modest about oneself"], "…and keeps its meaning");

// ── several meanings ─────────────────────────────────────────────────────────
const multi = parseWordList("abate — to lessen in intensity; to reduce in amount; to put an end to");
eq(multi.words[0].meanings.length, 3, "three senses off one line");
eq(multi.words[0].meanings[2], "to put an end to", "trailing sense kept");

const numbered = parseWordList("cardinal — 1. of foremost importance 2. a deep red 3. a songbird");
eq(numbered.words[0].meanings, ["of foremost importance", "a deep red", "a songbird"], "numbered senses");

// ── junk and edge cases ──────────────────────────────────────────────────────
const messy = parseWordList([
  "",
  "   ",
  "justawordwithnomeaning",
  "— meaning with no word",
  "lonely —   ",
  "valid — a real meaning",
].join("\n"));
eq(messy.words.map((w) => w.word), ["valid"], "only the valid line is kept");
eq(messy.skipped.length, 3, "three lines reported, not silently dropped");
ok(messy.skipped.every((s) => s.line > 0 && s.reason), "each skip names its line and reason");

const dupes = parseWordList("abate — to lessen\nabate — to reduce in amount\nABATE — to lessen");
eq(dupes.words.length, 1, "the same word twice merges");
eq(dupes.words[0].meanings, ["to lessen", "to reduce in amount"], "…merging senses, without duplicating");

// ── building the test ────────────────────────────────────────────────────────
// Three words: one with three senses, two with one each, plus filler for distractors.
const meanings = [
  { id: "m1", wordId: "w1", text: "to lessen" },
  { id: "m2", wordId: "w1", text: "to reduce in amount" },
  { id: "m3", wordId: "w1", text: "to put an end to" },
  { id: "m4", wordId: "w2", text: "deviating from the norm" },
  { id: "m5", wordId: "w3", text: "to depart secretly" },
  { id: "m6", wordId: "w4", text: "an award or honour" },
  { id: "m7", wordId: "w5", text: "excessively dry" },
  { id: "m8", wordId: "w6", text: "dull, commonplace" },
];
const questions = buildQuestions(meanings, { random: seededRng(42) });

eq(questions.length, meanings.length, "one question per meaning, not per word");
eq(questions.map((q) => q.position), [...meanings.keys()], "positions are 0..n-1 in order");
eq([...new Set(questions.map((q) => q.meaningId))].length, meanings.length, "every meaning asked exactly once");

const byId = new Map(meanings.map((m) => [m.id, m]));
for (const q of questions) {
  ok(q.optionIds.length === OPTIONS_PER_QUESTION, `question ${q.meaningId} has ${OPTIONS_PER_QUESTION} options`);
  ok(q.optionIds.includes(q.meaningId), `question ${q.meaningId} includes its own answer`);
  ok(new Set(q.optionIds).size === q.optionIds.length, `question ${q.meaningId} has no repeated option`);

  // The rule that keeps the test honest.
  const ownWord = byId.get(q.meaningId).wordId;
  const sameWordDistractors = q.optionIds
    .filter((id) => id !== q.meaningId)
    .filter((id) => byId.get(id).wordId === ownWord);
  eq(sameWordDistractors, [], `question ${q.meaningId}: no distractor from its own word`);

  // One option per word: two senses of the same other word would waste a slot.
  const wordsOnShow = q.optionIds.map((id) => byId.get(id).wordId);
  eq(new Set(wordsOnShow).size, wordsOnShow.length, `question ${q.meaningId}: one option per word`);
}

// ── two words, one definition ────────────────────────────────────────────────
// Real lists do this: amiable and amicable are both "friendly". Offering one as a distractor for
// the other marks a correct answer wrong, so an option must never read the same as the answer.
const clashing = [
  { id: "c1", wordId: "amiable", text: "friendly" },
  { id: "c2", wordId: "amicable", text: "  Friendly.  " },
  { id: "c3", wordId: "cloying", text: "sickeningly sweet" },
  { id: "c4", wordId: "saccharine", text: "sickeningly sweet" },
  { id: "c5", wordId: "arid", text: "excessively dry" },
  { id: "c6", wordId: "banal", text: "dull, commonplace" },
];
const byClashId = new Map(clashing.map((m) => [m.id, m]));
const norm = (t) => t.toLowerCase().replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim();
for (let seed = 1; seed <= 40; seed++) {
  for (const q of buildQuestions(clashing, { random: seededRng(seed) })) {
    const answer = norm(byClashId.get(q.meaningId).text);
    const others = q.optionIds.filter((id) => id !== q.meaningId).map((id) => norm(byClashId.get(id).text));
    ok(!others.includes(answer), `seed ${seed}, ${q.meaningId}: no distractor reading the same as the answer`);
    eq(new Set(others).size, others.length, `seed ${seed}, ${q.meaningId}: no two distractors reading alike`);
  }
}

// ── a short run out of a long list ───────────────────────────────────────────
const limited = buildQuestions(meanings, { limit: 3, random: seededRng(11) });
eq(limited.length, 3, "limit caps how many questions are asked");
eq(limited.map((q) => q.position), [0, 1, 2], "…and they are still positioned 0..n-1");
eq([...new Set(limited.map((q) => q.meaningId))].length, 3, "…with no meaning asked twice");
for (const q of limited) ok(q.optionIds.includes(q.meaningId), "short run: answer present");

// Distractors come from the whole list, not just the meanings being asked about — otherwise a
// 25-question run would show the same 25 options over and over.
const askedIds = new Set(limited.map((q) => q.meaningId));
const optionsOutsideTheRun = limited.flatMap((q) => q.optionIds).filter((id) => !askedIds.has(id));
ok(optionsOutsideTheRun.length > 0, "short run draws distractors from the whole list");

eq(buildQuestions(meanings, { limit: 999, random: seededRng(11) }).length, meanings.length,
  "a limit above the list size asks the whole list");
eq(buildQuestions(meanings, { random: seededRng(11) }).length, meanings.length,
  "no limit asks the whole list");
eq(buildQuestions(meanings, { limit: 0, random: seededRng(11) }).length, 0, "a limit of zero asks nothing");

// ── a word with few neighbours still gets a question ─────────────────────────
const tiny = buildQuestions(
  [{ id: "a1", wordId: "x", text: "one" }, { id: "a2", wordId: "x", text: "two" }, { id: "b1", wordId: "y", text: "three" }],
  { random: seededRng(7) },
);
eq(tiny.length, 3, "a tiny list still produces every question");
for (const q of tiny) {
  ok(q.optionIds.includes(q.meaningId), "tiny list: answer still present");
  ok(q.optionIds.length <= OPTIONS_PER_QUESTION, "tiny list: never more options than the cap");
}
const onlyOne = buildQuestions([{ id: "s1", wordId: "solo", text: "alone" }], { random: seededRng(3) });
eq(onlyOne.length, 1, "one meaning in the whole list still gives one question");
eq(onlyOne[0].optionIds, ["s1"], "…with nothing to distract it");

// ── the shuffle actually shuffles, and keeps everything ──────────────────────
const items = Array.from({ length: 50 }, (_, i) => i);
const mixed = shuffle(items, seededRng(9));
eq([...mixed].sort((a, b) => a - b), items, "shuffle loses and invents nothing");
ok(mixed.join() !== items.join(), "shuffle changes the order");
eq(items, Array.from({ length: 50 }, (_, i) => i), "shuffle does not mutate its input");

// Two runs over the same list differ — otherwise "shuffled again" would be a lie.
const runA = buildQuestions(meanings, { random: seededRng(1) }).map((q) => q.meaningId).join();
const runB = buildQuestions(meanings, { random: seededRng(2) }).map((q) => q.meaningId).join();
ok(runA !== runB, "a fresh run comes out in a different order");

// ── the list that ships with the repo ────────────────────────────────────────
// Guards the data, not just the code: an edit to sat-vocab-list.ts that breaks the format fails
// here rather than silently dropping words at import time.
const builtin = parseWordList(SAT_VOCAB_LIST);
eq(builtin.skipped, [], "every line of the built-in list parses");
eq(builtin.words.length, SAT_VOCAB_WORD_COUNT, "…and the advertised word count is the real one");
ok(builtin.words.length > 900, "the built-in list is the whole list");
ok(builtin.words.every((w) => w.meanings.length > 0), "every built-in word has at least one meaning");
ok(builtin.words.every((w) => !/[\s,;]/.test(w.word)), "no built-in word token swallowed its meaning");
ok(builtin.words.every((w) => w.meanings.every((m) => m.length > 1)), "no built-in meaning is a stray fragment");
const builtinWords = builtin.words.map((w) => w.word.toLowerCase());
eq(new Set(builtinWords).size, builtinWords.length, "no word appears twice in the built-in list");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
