export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { syncTasks } from "@/lib/task-service";
import { toModuleView } from "@/lib/tasks";
import ModuleManager, { type ModuleRow } from "@/components/tasks/ModuleManager";

export default async function ModulesPage() {
  await syncTasks();

  const modules = await db.module.findMany({
    orderBy: [{ archived: "asc" }, { name: "asc" }],
    include: {
      tasks: {
        select: { status: true, xpAwards: { select: { amount: true } } },
      },
    },
  });

  const rows: ModuleRow[] = modules.map((mod) => ({
    ...toModuleView(mod),
    taskCount: mod.tasks.length,
    completed: mod.tasks.filter((t) => t.status === "COMPLETED").length,
    failed: mod.tasks.filter((t) => t.status === "FAILED").length,
    xp: mod.tasks.reduce((sum, t) => sum + t.xpAwards.reduce((n, a) => n + a.amount, 0), 0),
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Modules</h2>
        <p className="text-sm text-gray-500 mt-0.5">The things you do, and the stats they train.</p>
      </div>
      <ModuleManager modules={rows} />
    </div>
  );
}
