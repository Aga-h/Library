export const dynamic = "force-dynamic";

import { clockKey, todayKey } from "@/lib/dates";
import { loadPlanner } from "@/lib/study-task-service";
import StudyPlanner from "@/components/study/StudyPlanner";

export default async function PlannerPage() {
  const now = new Date();
  const snapshot = await loadPlanner();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Planner</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          What you need to study, and when it’s due. A task without a date is fine — it waits in No date.
        </p>
      </div>
      {snapshot ? (
        <StudyPlanner
          tasks={snapshot.tasks}
          subjects={snapshot.subjects}
          categories={snapshot.categories}
          today={todayKey(now)}
          clock={clockKey(now)}
        />
      ) : (
        <p className="text-sm text-gray-500">
          The planner is waiting on a database update. Run <code>039-study-tasks.sql</code> in the
          Supabase SQL editor, then reload this page.
        </p>
      )}
    </div>
  );
}
