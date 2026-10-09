import { NextResponse } from "next/server";
import { loadMonth } from "@/lib/finances";
import { isSubscriptionActiveInMonth } from "@/lib/finances-utils";
import { monthBalances } from "@/lib/fund-sources";
import { chargesInMonth } from "@/lib/installments";
import { parseMonthParams } from "@/lib/month-params";
import { withErrors } from "@/lib/api-errors";

async function GETHandler(
  _request: Request,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const parsed = parseMonthParams(await params);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }
  const { year, month } = parsed;

  const { config, expenses, income, subscriptions, installments, carryover } = await loadMonth(year, month);
  const active = subscriptions.filter((s) => isSubscriptionActiveInMonth(s, year, month));
  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const balances = monthBalances({
    budget: config.monthlyBudget,
    carryover,
    income: totalIncome,
    charges: [...expenses, ...active, ...chargesInMonth(installments, year, month)],
  });

  return NextResponse.json({
    config: { monthlyBudget: config.monthlyBudget },
    expenses,
    income,
    subscriptions,
    installments,
    // Kept as one number for anything reading the old shape; per pot below.
    carryover: carryover.base + carryover.extra,
    totalExpenses: balances.total.spent,
    totalIncome,
    available: balances.total.available,
    remaining: balances.total.left,
    // What is left on each card: Base (the budget) and Extra (additional income).
    balances,
  });
}

export const GET = withErrors(GETHandler);
