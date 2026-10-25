import Link from "next/link";
import { clockKey, todayKey } from "@/lib/dates";
import { loadPlanner } from "@/lib/study-task-service";
import { plannerOverview } from "@/lib/study-tasks";

/** A line on the Study page. Absent until migration 039 has run, so Study itself keeps loading. */
export default async function PlannerGlance() {
  const snapshot = await loadPlanner();
  if (!snapshot) return null;
  const now = new Date();
  const overview = plannerOverview(snapshot.tasks, todayKey(now), clockKey(now));

  return (
    <Link href="/study/tasks" className="block bg-white border border-gray-200 rounded-xl px-4 py-3">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Planner</p>
      <p className="text-sm mt-1 text-gray-700">
        {overview.dueToday === 0 ? "Nothing due today" : `${overview.dueToday} due today`}
        {overview.overdue > 0 && (
          <span className="text-red-600"> · {overview.overdue} overdue</span>
        )}
      </p>
    </Link>
  );
}
