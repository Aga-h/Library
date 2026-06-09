import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeCarryover, isSubscriptionActiveInMonth } from "@/lib/finances";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const { year: yearStr, month: monthStr } = await params;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const [config, expenses, income, subscriptions, carryover] = await Promise.all([
    db.financeConfig.upsert({
      where: { id: "global" },
      create: { id: "global", monthlyBudget: 0 },
      update: {},
    }),
    db.expense.findMany({ where: { year, month }, orderBy: { createdAt: "desc" } }),
    db.additionalIncome.findMany({ where: { year, month }, orderBy: { createdAt: "desc" } }),
    db.subscription.findMany({ orderBy: { createdAt: "asc" } }),
    computeCarryover(year, month),
  ]);

  const subscriptionTotal = subscriptions
    .filter((s) => isSubscriptionActiveInMonth(s, year, month))
    .reduce((sum, s) => sum + s.amount, 0);

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0) + subscriptionTotal;
  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const available = config.monthlyBudget + carryover + totalIncome;
  const remaining = available - totalExpenses;

  return NextResponse.json({
    config: { monthlyBudget: config.monthlyBudget },
    expenses,
    income,
    subscriptions,
    carryover,
    totalExpenses,
    totalIncome,
    available,
    remaining,
  });
}
