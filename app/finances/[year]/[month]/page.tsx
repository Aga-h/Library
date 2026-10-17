import { loadMonth } from "@/lib/finances";
import { isSubscriptionActiveInMonth } from "@/lib/finances-utils";
import { monthBalances } from "@/lib/fund-sources";
import { chargesInMonth } from "@/lib/installments";
import MonthNav from "@/components/finances/MonthNav";
import BudgetSummary from "@/components/finances/BudgetSummary";
import ExpenseSection from "@/components/finances/ExpenseSection";
import IncomeSection from "@/components/finances/IncomeSection";
import SubscriptionSection from "@/components/finances/SubscriptionSection";
import InstallmentSection from "@/components/finances/InstallmentSection";
import BudgetConfig from "@/components/finances/BudgetConfig";
import { notFound } from "next/navigation";
import { parseMonthParams } from "@/lib/month-params";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PHONE_TALL } from "@/components/finances/touch";

interface PageProps {
  params: Promise<{ year: string; month: string }>;
}

export default async function FinancesMonthPage({ params }: PageProps) {
  const parsed = parseMonthParams(await params);
  if (!parsed) notFound();
  const { year, month } = parsed;

  const { config, expenses, income, subscriptions, installments, carryover } = await loadMonth(year, month);
  const active = subscriptions.filter((s) => isSubscriptionActiveInMonth(s, year, month));
  const balances = monthBalances({
    budget: config.monthlyBudget,
    carryover,
    income: income.reduce((s, i) => s + i.amount, 0),
    charges: [...expenses, ...active, ...chargesInMonth(installments, year, month)],
  });

  return (
    <div>
      {/* Phones: the month on its own row, Quick log full width under it. */}
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:mb-2">
        <div className="sm:flex-1"><MonthNav year={year} month={month} /></div>
        <Link
          href="/finances/log"
          className={`flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 sm:py-2 ${PHONE_TALL}`}
        >
          <Plus className="h-4 w-4" /> Quick log
        </Link>
      </div>
      <BudgetSummary balances={balances} />
      {/* grid-cols-1 is minmax(0, 1fr): without it the one implicit column grows to the widest
          unbroken row (a long expense description) and the page scrolls sideways on a phone. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <ExpenseSection expenses={expenses} year={year} month={month}
          left={{ BASE: balances.base.left, EXTRA: balances.extra.left }} />
        <div className="flex min-w-0 flex-col gap-6">
          <IncomeSection income={income} year={year} month={month} />
          <SubscriptionSection subscriptions={subscriptions} year={year} month={month} />
          <InstallmentSection key={`${year}-${month}`} installments={installments} year={year} month={month} />
          <BudgetConfig currentBudget={config.monthlyBudget} />
        </div>
      </div>
    </div>
  );
}
