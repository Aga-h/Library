import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeCarryover } from "@/lib/finances";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const { year: yearStr, month: monthStr } = await params;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const [config, expenses, income, carryover] = await Promise.all([
    db.financeConfig.upsert({
      where: { id: "global" },
      create: { id: "global", monthlyBudget: 0 },
      update: {},
    }),
    db.expense.findMany({ where: { year, month }, orderBy: { createdAt: "desc" } }),
    db.additionalIncome.findMany({ where: { year, month }, orderBy: { createdAt: "desc" } }),
    computeCarryover(year, month),
  ]);

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const available = config.monthlyBudget + carryover + totalIncome;
  const remaining = available - totalExpenses;

  return NextResponse.json({
    config: { monthlyBudget: config.monthlyBudget },
    expenses,
    income,
    carryover,
    totalExpenses,
    totalIncome,
    available,
    remaining,
  });
}
