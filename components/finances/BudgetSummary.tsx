function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

interface Props {
  budget: number;
  carryover: number;
  totalIncome: number;
  available: number;
  totalExpenses: number;
  remaining: number;
}

export default function BudgetSummary({ budget, carryover, totalIncome, available, totalExpenses, remaining }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Available this month</p>
          <p className={`text-xl font-bold ${available >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(available)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total spent</p>
          <p className="text-xl font-bold text-gray-900">{fmt(totalExpenses)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Remaining</p>
          <p className={`text-xl font-bold ${remaining >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(remaining)}</p>
        </div>
      </div>
      <div className="flex gap-4 text-xs text-gray-500 px-1">
        <span>Base budget: <span className="font-medium text-gray-700">{fmt(budget)}</span></span>
        <span>·</span>
        <span>
          Carryover: <span className={`font-medium ${carryover >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {carryover >= 0 ? "+" : ""}{fmt(carryover)}
          </span>
        </span>
        {totalIncome > 0 && (
          <>
            <span>·</span>
            <span>Extra income: <span className="font-medium text-emerald-600">+{fmt(totalIncome)}</span></span>
          </>
        )}
      </div>
    </div>
  );
}
