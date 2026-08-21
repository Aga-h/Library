export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import DayPlanForm from "@/components/calendar/DayPlanForm";

export default function NewDayPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/calendar/days" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Days
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Add Day</h1>
        <DayPlanForm mode="create" />
      </div>
    </div>
  );
}
