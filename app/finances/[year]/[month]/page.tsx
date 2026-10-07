import { loadMonth } from "@/lib/finances";
import { isSubscriptionActiveInMonth } from "@/lib/finances-utils";
import { monthBalances } from "@/lib/fund-sources";
import MonthNav from "@/components/finances/MonthNav";
import BudgetSummary from "@/components/finances/BudgetSummary";
import ExpenseSection from "@/components/finances/ExpenseSection";
import IncomeSection from "@/components/finances/IncomeSection";
import SubscriptionSection from "@/components/finances/SubscriptionSection";
import BudgetConfig from "@/components/finances/BudgetConfig";
import { notFound } from "next/navigation";
import { parseMonthParams } from "@/lib/month-params";
import { Plus } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ year: string; month: string }>;
}

export default async function FinancesMonthPage({ params }: PageProps) {
  const parsed = parseMonthParams(await params);
  if (!parsed) notFound();
  const { year, month } = parsed;

  const { config, expenses, income, subscriptions, carryover } = await loadMonth(year, month);
  const active = subscriptions.filter((s) => isSubscriptionActiveInMonth(s, year, month));
  const balances = monthBalances({
    budget: config.monthlyBudget,
    carryover,
    income: income.reduce((s, i) => s + i.amount, 0),
    charges: [...expenses, ...active],
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex-1"><MonthNav year={year} month={month} /></div>
        <Link
          href="/finances/log"
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" /> Quick log
        </Link>
      </div>
      <BudgetSummary balances={balances} />
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <ExpenseSection expenses={expenses} year={year} month={month}
          left={{ BASE: balances.base.left, EXTRA: balances.extra.left }} />
        <div className="flex flex-col gap-6">
          <IncomeSection income={income} year={year} month={month} />
          <SubscriptionSection subscriptions={subscriptions} year={year} month={month} />
          <BudgetConfig currentBudget={config.monthlyBudget} />
        </div>
      </div>
    </div>
  );
}
