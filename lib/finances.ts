import { db } from "@/lib/db";

export async function computeCarryover(targetYear: number, targetMonth: number): Promise<number> {
  const config = await db.financeConfig.findUnique({ where: { id: "global" } });
  const budget = config?.monthlyBudget ?? 0;

  const [expenseGroups, incomeGroups] = await Promise.all([
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
  ]);

  const monthMap = new Map<string, { expenses: number; income: number }>();
  for (const g of expenseGroups) {
    const key = `${g.year}-${g.month}`;
    const entry = monthMap.get(key) ?? { expenses: 0, income: 0 };
    entry.expenses = g._sum.amount ?? 0;
    monthMap.set(key, entry);
  }
  for (const g of incomeGroups) {
    const key = `${g.year}-${g.month}`;
    const entry = monthMap.get(key) ?? { expenses: 0, income: 0 };
    entry.income = g._sum.amount ?? 0;
    monthMap.set(key, entry);
  }

  const months = Array.from(monthMap.keys()).sort();

  let carryover = 0;
  for (const key of months) {
    const { expenses, income } = monthMap.get(key)!;
    carryover = budget + income + carryover - expenses;
  }

  return carryover;
}
