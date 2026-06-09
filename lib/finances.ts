import { db } from "@/lib/db";
import { compareMonths, padKey, isSubscriptionActiveInMonth } from "@/lib/finances-utils";

export { isSubscriptionActiveInMonth } from "@/lib/finances-utils";

export async function computeCarryover(targetYear: number, targetMonth: number): Promise<number> {
  const config = await db.financeConfig.findUnique({ where: { id: "global" } });
  const budget = config?.monthlyBudget ?? 0;

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
