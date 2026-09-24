export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import ModulesManager from "@/components/study/ModulesManager";

export default async function ModulesPage() {
  const modules = await db.module.findMany({
    orderBy: { title: "asc" },
    include: { _count: { select: { sessions: true } } },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Modules</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          The things you study. Each trains one to three stats; pick a module when you start a
          session and those are the stats it levels.
        </p>
      </div>
      <ModulesManager
        modules={modules.map((m) => ({
          id: m.id,
          title: m.title,
          notes: m.notes,
          stats: m.stats,
          sessions: m._count.sessions,
        }))}
      />
    </div>
  );
}
