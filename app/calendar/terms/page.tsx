export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { toKey } from "@/lib/calendar-dates";
import TermsManager from "@/components/calendar/TermsManager";

export default async function TermsPage() {
  const [terms, daysOff] = await Promise.all([
    db.schoolTerm.findMany({ orderBy: { startDate: "asc" } }),
    db.dayOff.findMany({ orderBy: { date: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/calendar" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Calendar
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">School terms</h1>
      <TermsManager
        terms={terms.map((t) => ({ id: t.id, name: t.name, startDate: toKey(t.startDate), endDate: toKey(t.endDate) }))}
        daysOff={daysOff.map((d) => ({ id: d.id, date: toKey(d.date), reason: d.reason }))}
      />
    </div>
  );
}
