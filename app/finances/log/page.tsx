export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import QuickExpenseForm from "@/components/finances/QuickExpenseForm";

export const metadata = {
  title: "Log expense",
};

export default function LogExpensePage() {
  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">Log expense</h1>
          <p className="text-sm text-gray-400">{monthLabel}</p>
        </div>
        <Link
          href={`/finances/${now.getFullYear()}/${now.getMonth() + 1}`}
          className="-mr-2 flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-2.5 text-sm font-medium text-gray-500 active:bg-gray-100 sm:mr-0 sm:py-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          Month
        </Link>
      </div>

      <QuickExpenseForm />
    </div>
  );
}
