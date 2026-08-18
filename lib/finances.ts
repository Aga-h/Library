import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { compareMonths, padKey, isSubscriptionActiveInMonth } from "@/lib/finances-utils";

export { isSubscriptionActiveInMonth } from "@/lib/finances-utils";

/**
 * @param budget Monthly budget. Passed in because every caller has already fetched the
 *   FinanceConfig singleton — reading it again here meant two concurrent queries for the same
 *   row, and awaiting it first serialised a round trip ahead of the parallel block below.
 */
export async function computeCarryover(
  targetYear: number,
  targetMonth: number,
  budget: number
): Promise<number> {
  const [expenseGroups, incomeGroups, subscriptions] = await Promise.all([
    db.expense.groupBy({
      by: ["year", "month"],
      _sum: { amount: true },
      where: {
        OR: [
          { year: { lt: targetYear } },
          { year: targetYear, month: { lt: targetMonth } },
        ],
      },
    }),
    db.additionalIncome.groupBy({
      by: ["year", "month"],
      _sum: { amount: true },
      where: {
        OR: [
          { year: { lt: targetYear } },
          { year: targetYear, month: { lt: targetMonth } },
        ],
      },
    }),
    db.subscription.findMany(),
  ]);

  const monthMap = new Map<string, { expenses: number; income: number }>();

  for (const g of expenseGroups) {
    const key = padKey(g.year, g.month);
    const entry = monthMap.get(key) ?? { expenses: 0, income: 0 };
    entry.expenses += g._sum.amount ?? 0;
    monthMap.set(key, entry);
  }
  for (const g of incomeGroups) {
    const key = padKey(g.year, g.month);
    const entry = monthMap.get(key) ?? { expenses: 0, income: 0 };
    entry.income += g._sum.amount ?? 0;
    monthMap.set(key, entry);
  }

  for (const sub of subscriptions) {
    let y = sub.startYear;
    let m = sub.startMonth;
    while (compareMonths(y, m, targetYear, targetMonth) < 0) {
      if (!isSubscriptionActiveInMonth(sub, y, m)) break;
      const key = padKey(y, m);
      const entry = monthMap.get(key) ?? { expenses: 0, income: 0 };
      entry.expenses += sub.amount;
      monthMap.set(key, entry);
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }

  const months = Array.from(monthMap.keys()).sort();

  let carryover = 0;
  for (const key of months) {
    const { expenses, income } = monthMap.get(key)!;
    carryover = budget + income + carryover - expenses;
  }

  return carryover;
}

/**
 * Cached carryover. computeCarryover replays every month of recorded history from the earliest
 * entry, and previously ran on every request and every month navigation.
 *
 * The "finance-stats" tag already had eight revalidateTag() call sites across the finance API
 * routes, but nothing was registered under it — they invalidated nothing. This is what makes
 * them real.
 */
export function getCarryover(year: number, month: number, budget: number): Promise<number> {
  return unstable_cache(
    () => computeCarryover(year, month, budget),
    ["finance-carryover", String(year), String(month), String(budget)],
    { tags: ["finance-stats"], revalidate: 3600 }
  )();
}
