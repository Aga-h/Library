// Installment purchases. The installments must add up to exactly the price, land one per month
// from the first, and stop by themselves after the last.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-installments.mjs
import {
  installmentAmounts, totalFromEach, addMonths, lastMonth, schedule, installmentInMonth, planState,
  chargesInMonth,
} from "../lib/installments.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
const cents = (xs) => xs.reduce((s, x) => s + Math.round(x * 100), 0);

// ── splitting the price ──────────────────────────────────────────────────────
eq(installmentAmounts(12000, 6), [2000, 2000, 2000, 2000, 2000, 2000], "an even split");
eq(installmentAmounts(1000, 3), [333.34, 333.33, 333.33], "what doesn't divide goes on the first");
eq(installmentAmounts(0.05, 2), [0.03, 0.02], "down to the kuruş");
eq([installmentAmounts(1999.99, 12)[0], installmentAmounts(1999.99, 12)[1]], [166.73, 166.66], "a price with kuruş: the 7 left over go on the first");
for (const [total, count] of [[1000, 3], [1999.99, 12], [74999.9, 9], [0.1, 3], [12345.67, 60], [100.01, 7]]) {
  eq(cents(installmentAmounts(total, count)), Math.round(total * 100), `${count} installments add up to ${total}`);
}
eq(totalFromEach(333.33, 3), 999.99, "N × the installment");
eq(totalFromEach(2000, 6), 12000, "…even");
eq(installmentAmounts(totalFromEach(333.33, 3), 3), [333.33, 333.33, 333.33], "entered per installment: every one is that amount");

// ── months ───────────────────────────────────────────────────────────────────
eq(addMonths(2026, 10, 3), { year: 2027, month: 1 }, "across the new year");
eq(addMonths(2026, 1, -1), { year: 2025, month: 12 }, "backwards");
eq(addMonths(2026, 12, 0), { year: 2026, month: 12 }, "December");
const phone = { total: 36000, count: 12, startYear: 2026, startMonth: 5 };
eq(lastMonth(phone), { year: 2027, month: 4 }, "12 from May: the last is April next year");
eq(lastMonth({ ...phone, count: 2, startMonth: 12 }), { year: 2027, month: 1 }, "2 from December");
const s = schedule({ total: 1000, count: 3, startYear: 2026, startMonth: 11 });
eq(s.map((x) => `${x.year}-${x.month} #${x.number} ${x.amount}`), ["2026-11 #1 333.34", "2026-12 #2 333.33", "2027-1 #3 333.33"], "the schedule");

eq(installmentInMonth(phone, 2026, 4), null, "nothing before the first");
eq(installmentInMonth(phone, 2026, 5), { number: 1, amount: 3000 }, "the first month");
eq(installmentInMonth(phone, 2026, 10), { number: 6, amount: 3000 }, "the sixth");
eq(installmentInMonth(phone, 2027, 4), { number: 12, amount: 3000 }, "the last");
eq(installmentInMonth(phone, 2027, 5), null, "ends by itself");

// ── where it stands ──────────────────────────────────────────────────────────
eq(planState(phone, 2026, 3), { phase: "upcoming", current: null, paidCount: 0, paid: 0, left: 36000 }, "upcoming");
eq(planState(phone, 2026, 10), { phase: "paying", current: { number: 6, amount: 3000 }, paidCount: 6, paid: 18000, left: 18000 }, "half way");
eq(planState(phone, 2027, 4).left, 0, "nothing left after the last");
eq(planState(phone, 2028, 1), { phase: "done", current: null, paidCount: 12, paid: 36000, left: 0 }, "paid off");
const odd = { total: 1000, count: 3, startYear: 2026, startMonth: 1 };
eq([planState(odd, 2026, 1).left, planState(odd, 2026, 2).left], [666.66, 333.33], "what's left, to the kuruş");

// ── as charges on a card ─────────────────────────────────────────────────────
const plans = [
  { ...phone, source: "BASE" },
  { total: 9000, count: 3, startYear: 2026, startMonth: 10, source: "EXTRA" },
  { total: 500, count: 2, startYear: 2026, startMonth: 11, source: "BASE" },
];
eq(chargesInMonth(plans, 2026, 10), [{ amount: 3000, source: "BASE" }, { amount: 3000, source: "EXTRA" }], "this month's, on their cards");
eq(chargesInMonth(plans, 2026, 12).length, 3, "all three in December");
eq(chargesInMonth(plans, 2027, 5), [], "all done");
// Over a plan's life its charges add up to its price.
let sum = 0;
for (let i = 0; i < 24; i++) {
  const { year, month } = addMonths(2026, 1, i);
  sum += cents(chargesInMonth([{ ...odd, source: "BASE" }], year, month).map((c) => c.amount));
}
eq(sum, 100000, "charged in full, once");

console.log(`${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
