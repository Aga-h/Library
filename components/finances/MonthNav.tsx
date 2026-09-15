import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function prevMonth(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function nextMonth(year: number, month: number) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

export default function MonthNav({ year, month }: { year: number; month: number }) {
  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);

  return (
    <div className="flex items-center justify-between mb-6">
      <Link
        href={`/finances/${prev.year}/${prev.month}`}
        aria-label="Previous month"
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900">
        <ChevronLeft className="w-5 h-5" />
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">
        {MONTHS[month - 1]} {year}
      </h1>
      <Link
        href={`/finances/${next.year}/${next.month}`}
        aria-label="Next month"
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900">
        <ChevronRight className="w-5 h-5" />
      </Link>
    </div>
  );
}
