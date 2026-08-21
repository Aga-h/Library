export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus, Sun, GraduationCap } from "lucide-react";
import { db } from "@/lib/db";

function formatMinute(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export default async function DaysPage() {
  const plans = await db.dayPlan.findMany({
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    include: { activities: { orderBy: { startMinute: "asc" } }, _count: { select: { days: true } } },
  });

  const school = plans.filter((p) => p.kind === "SCHOOL");
  const holiday = plans.filter((p) => p.kind === "HOLIDAY");

  const section = (title: string, Icon: typeof Sun, list: typeof plans, empty: string) => (
    <section className="mb-10">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        <Icon className="w-4 h-4" /> {title} · {list.length}
      </h2>
      {list.length === 0 ? (
        <p className="text-sm text-gray-400">{empty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {list.map((p) => (
            <Link key={p.id} href={`/calendar/days/${p.id}`}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-400 hover:shadow-md transition-all">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-gray-900">{p.name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {p._count.days === 0 ? "not used yet" : `on ${p._count.days} ${p._count.days === 1 ? "date" : "dates"}`}
                </span>
              </div>
              {p.activities.length === 0 ? (
                <p className="text-xs text-gray-400 mt-2">No activities yet</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-0.5">
                  {p.activities.map((a) => (
                    <li key={a.id} className="text-xs text-gray-500">
                      <span className="text-gray-400 tabular-nums">{formatMinute(a.startMinute)}</span> {a.title}
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Days</h1>
          <p className="text-sm text-gray-500 mt-1">
            The days the calendar deals from. Each one is a timetable.
          </p>
        </div>
        <Link href="/calendar/days/new"
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Day
        </Link>
      </div>

      {section("Holiday days", Sun, holiday, "No holiday days yet — weekends and breaks have nothing to deal.")}
      {section("School days", GraduationCap, school, "No school days yet — term weekdays have nothing to deal.")}
    </div>
  );
}
