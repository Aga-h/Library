import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeCarryover } from "@/lib/finances";
import { isSubscriptionActiveInMonth } from "@/lib/finances-utils";
import { parseMonthParams } from "@/lib/month-params";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const parsed = parseMonthParams(await params);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }
  const { year, month } = parsed;

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
