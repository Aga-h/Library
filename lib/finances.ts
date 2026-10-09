import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { compareMonths, padKey, isSubscriptionActiveInMonth } from "@/lib/finances-utils";
import { emptyFlow, rollCarryover, type MonthFlow, type SourceSplit } from "@/lib/fund-sources";
import { schedule } from "@/lib/installments";

export { isSubscriptionActiveInMonth } from "@/lib/finances-utils";

/**
 * What each pot — Base (the budget) and Extra (additional income) — carries into the target month,
 * replaying every earlier month of history. The arithmetic is `rollCarryover`, tested on its own.
 *
 * @param budget Monthly budget. Passed in because every caller has already fetched the
 *   FinanceConfig singleton — reading it again here meant two concurrent queries for the same
 *   row, and awaiting it first serialised a round trip ahead of the parallel block below.
 */
export async function computeCarryover(
  targetYear: number,
  targetMonth: number,
  budget: number
): Promise<SourceSplit> {
  const before = {
    OR: [
      { year: { lt: targetYear } },
      { year: targetYear, month: { lt: targetMonth } },
    ],
  };
  const [expenseGroups, incomeGroups, subscriptions, installments] = await Promise.all([
    db.expense.groupBy({ by: ["year", "month", "source"], _sum: { amount: true }, where: before }),
    db.additionalIncome.groupBy({ by: ["year", "month"], _sum: { amount: true }, where: before }),
    db.subscription.findMany(),
    db.installment.findMany(),
  ]);

  const monthMap = new Map<string, MonthFlow>();
  const flowOf = (year: number, month: number) => {
    const key = padKey(year, month);
    let flow = monthMap.get(key);
    if (!flow) monthMap.set(key, (flow = emptyFlow()));
    return flow;
  };

  for (const g of expenseGroups) flowOf(g.year, g.month).spent[g.source] += g._sum.amount ?? 0;
  for (const g of incomeGroups) flowOf(g.year, g.month).income += g._sum.amount ?? 0;

  for (const sub of subscriptions) {
    let y = sub.startYear;
    let m = sub.startMonth;
    while (compareMonths(y, m, targetYear, targetMonth) < 0) {
      if (!isSubscriptionActiveInMonth(sub, y, m)) break;
      flowOf(y, m).spent[sub.source] += sub.amount;
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }

  // Each installment lands in its own month, until the last.
  for (const plan of installments) {
    for (const due of schedule(plan)) {
      if (compareMonths(due.year, due.month, targetYear, targetMonth) >= 0) break;
      flowOf(due.year, due.month).spent[plan.source] += due.amount;
    }
  }

  const months = [...monthMap.keys()].sort().map((key) => monthMap.get(key)!);
  return rollCarryover(months, budget);
}

/**
 * Cached carryover. computeCarryover replays every month of recorded history from the earliest
 * entry, and previously ran on every request and every month navigation.
 *
 * The "finance-stats" tag already had eight revalidateTag() call sites across the finance API
 * routes, but nothing was registered under it — they invalidated nothing. This is what makes
 * them real.
 *
 * Writes expire the tag at once (`revalidateTag(tag, { expire: 0 })`). The recommended "max" profile
 * serves the stale value one more time first — which showed the wrong amount left on each card
 * right after moving or deleting an earlier month's expense.
 *
 * The key names the value's shape ("by-source"): when carryover changed from one number to a pot
 * per source, an entry cached under the old key would have handed a number to code expecting both.
 */
export function getCarryover(year: number, month: number, budget: number): Promise<SourceSplit> {
  return unstable_cache(
    () => computeCarryover(year, month, budget),
    ["finance-carryover-by-source", String(year), String(month), String(budget)],
    { tags: ["finance-stats"], revalidate: 3600 }
  )();
}

/** The month's records and money per pot — shared by the month page and its API. */
export async function loadMonth(year: number, month: number) {
  const [config, expenses, income, subscriptions, installments] = await Promise.all([
    db.financeConfig.upsert({
      where: { id: "global" },
      create: { id: "global", monthlyBudget: 0 },
      update: {},
    }),
    db.expense.findMany({ where: { year, month }, orderBy: { createdAt: "desc" } }),
    db.additionalIncome.findMany({ where: { year, month }, orderBy: { createdAt: "desc" } }),
    db.subscription.findMany({ orderBy: { createdAt: "asc" } }),
    db.installment.findMany({ orderBy: [{ startYear: "asc" }, { startMonth: "asc" }, { createdAt: "asc" }] }),
  ]);
  const carryover = await getCarryover(year, month, config.monthlyBudget);
  return { config, expenses, income, subscriptions, installments, carryover };
}
