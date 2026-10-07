// Money sources. Two pots (Base: the budget; Extra: additional income) must always add up to the
// single total the page showed before they existed, and each must carry its own balance forward.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-finances.mjs
import {
  rollCarryover, monthBalances, leftAfterPending, emptyFlow, isFundSource, FUND_SOURCES,
} from "../lib/fund-sources.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}

const flow = (income, base, extra) => ({ income, spent: { BASE: base, EXTRA: extra } });

// ── carrying both pots forward ───────────────────────────────────────────────
eq(rollCarryover([], 5000), { base: 0, extra: 0 }, "no history, nothing carried");
eq(rollCarryover([flow(0, 4200, 0)], 5000), { base: 800, extra: 0 }, "base keeps what the budget didn't spend");
eq(rollCarryover([flow(1000, 3000, 600)], 5000), { base: 2000, extra: 400 }, "extra keeps what extra income didn't spend");
eq(rollCarryover([flow(0, 6000, 0), flow(0, 4000, 0)], 5000), { base: 0, extra: 0 }, "an overspent month is made up by the next");
eq(rollCarryover([flow(0, 0, 250)], 5000), { base: 5000, extra: -250 }, "spending extra money you don't have goes negative — on that card only");

// The two pots always add up to the old single carryover (budget + income − expenses, per month).
const history = [flow(1200, 4100, 300), flow(0, 5200, 0), flow(800, 3900, 1100), flow(0, 0, 0)];
const oldSingle = history.reduce((c, m) => 5000 + m.income + c - m.spent.BASE - m.spent.EXTRA, 0);
const split = rollCarryover(history, 5000);
eq(split.base + split.extra, oldSingle, "base + extra = the carryover shown before sources");

// ── this month ───────────────────────────────────────────────────────────────
const b = monthBalances({
  budget: 5000,
  carryover: { base: 300, extra: 150 },
  income: 1000,
  charges: [
    { amount: 1200, source: "BASE" },
    { amount: 60, source: "BASE" }, // a subscription
    { amount: 400, source: "EXTRA" },
  ],
});
eq(b.base, { incoming: 5000, carried: 300, spent: 1260, left: 4040 }, "base: budget + carried − spent");
eq(b.extra, { incoming: 1000, carried: 150, spent: 400, left: 750 }, "extra: income + carried − spent");
eq(b.total, { available: 6450, spent: 1660, left: 4790 }, "totals are the sum of the pots");
eq(b.total.left, 5000 + 300 + 150 + 1000 - 1660, "…and match the old 'remaining' formula");

const empty = monthBalances({ budget: 0, carryover: { base: 0, extra: 0 }, income: 0, charges: [] });
eq(empty.total, { available: 0, spent: 0, left: 0 }, "nothing at all");

// ── what's queued on the phone but not uploaded yet ──────────────────────────
const pending = [
  { amount: 50, source: "BASE", year: 2026, month: 10 },
  { amount: 20, source: "EXTRA", year: 2026, month: 10 },
  { amount: 30, year: 2026, month: 10 }, // queued before sources existed
  { amount: 999, source: "BASE", year: 2026, month: 9 }, // last month: not this balance
];
eq(leftAfterPending({ base: 1000, extra: 100 }, pending, 2026, 10), { base: 920, extra: 80 },
  "queued expenses come off their card; an old one counts as Base; other months don't count");
eq(leftAfterPending({ base: 1000, extra: 100 }, [], 2026, 10), { base: 1000, extra: 100 }, "nothing queued");

eq(FUND_SOURCES, ["BASE", "EXTRA"], "two sources");
eq([isFundSource("BASE"), isFundSource("EXTRA"), isFundSource("base"), isFundSource(undefined)], [true, true, false, false], "only the exact names");
eq(emptyFlow(), { income: 0, spent: { BASE: 0, EXTRA: 0 } }, "an empty month");

console.log(`${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
