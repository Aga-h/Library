import { db } from "@/lib/db";
import { getCarryover } from "@/lib/finances";
import { isSubscriptionActiveInMonth } from "@/lib/finances-utils";
import MonthNav from "@/components/finances/MonthNav";
import BudgetSummary from "@/components/finances/BudgetSummary";
import ExpenseSection from "@/components/finances/ExpenseSection";
import IncomeSection from "@/components/finances/IncomeSection";
import SubscriptionSection from "@/components/finances/SubscriptionSection";
import BudgetConfig from "@/components/finances/BudgetConfig";
import { notFound } from "next/navigation";
import { parseMonthParams } from "@/lib/month-params";

interface PageProps {
  params: Promise<{ year: string; month: string }>;
}

export default async function FinancesMonthPage({ params }: PageProps) {
  const parsed = parseMonthParams(await params);
  if (!parsed) notFound();
  const { year, month } = parsed;

  const [config, expenses, income, subscriptions] = await Promise.all([
    db.financeConfig.upsert({
      where: { id: "global" },
      create: { id: "global", monthlyBudget: 0 },
      update: {},
    }),
    db.expense.findMany({ where: { year, month }, orderBy: { createdAt: "desc" } }),
    db.additionalIncome.findMany({ where: { year, month }, orderBy: { createdAt: "desc" } }),
    db.subscription.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const carryover = await getCarryover(year, month, config.monthlyBudget);

  const subscriptionTotal = subscriptions
    .filter((s) => isSubscriptionActiveInMonth(s, year, month))
    .reduce((sum, s) => sum + s.amount, 0);

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0) + subscriptionTotal;
  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const available = config.monthlyBudget + carryover + totalIncome;
  const remaining = available - totalExpenses;

  return (
    <div>
      <MonthNav year={year} month={month} />
      <BudgetSummary
        budget={config.monthlyBudget}
        carryover={carryover}
        totalIncome={totalIncome}
        available={available}
        totalExpenses={totalExpenses}
        remaining={remaining}
      />
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <ExpenseSection expenses={expenses} year={year} month={month} />
        <div className="flex flex-col gap-6">
          <IncomeSection income={income} year={year} month={month} />
          <SubscriptionSection subscriptions={subscriptions} year={year} month={month} />
          <BudgetConfig currentBudget={config.monthlyBudget} />
        </div>
      </div>
    </div>
  );
}
