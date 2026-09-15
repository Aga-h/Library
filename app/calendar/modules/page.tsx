export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import ModulesManager from "@/components/calendar/ModulesManager";

export default async function ModulesPage() {
  const modules = await db.eventModule.findMany({
    orderBy: [{ startMinute: "asc" }, { title: "asc" }],
    include: { _count: { select: { placements: true } } },
  });

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/calendar" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Calendar
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">Modules</h1>
      <p className="text-sm text-gray-500 mt-1 mb-8">
        An event and the hours it takes. Place a module into any number of days — editing it here
        updates every day it is in.
      </p>
      <ModulesManager
        modules={modules.map((m) => ({
          id: m.id, title: m.title, startMinute: m.startMinute,
          endMinute: m.endMinute, usedInDays: m._count.placements,
        }))}
      />
    </div>
  );
}
