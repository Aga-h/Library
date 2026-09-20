"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, GraduationCap } from "lucide-react";

export interface ApUnitRow {
  id: string;
  number: number;
  title: string;
  weighting: string | null;
  completedAt: string | null;
}

export interface ApCourseRow {
  id: string;
  name: string;
  shortName: string;
  /** Courses College Board numbers as one sequence share this, and render together. */
  series: string | null;
  units: ApUnitRow[];
}

/** Consecutive courses of the same series become one group; everything else stands alone. */
function groupBySeries(courses: ApCourseRow[]): { key: string; series: string | null; courses: ApCourseRow[] }[] {
  const groups: { key: string; series: string | null; courses: ApCourseRow[] }[] = [];
  for (const course of courses) {
    const last = groups[groups.length - 1];
    if (course.series && last && last.series === course.series) last.courses.push(course);
    else groups.push({ key: course.id, series: course.series, courses: [course] });
  }
  return groups;
}

const doneCount = (units: ApUnitRow[]) => units.filter((u) => u.completedAt !== null).length;

export default function ApTracker({ courses }: { courses: ApCourseRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(unit: ApUnitRow) {
    setPending(unit.id);
    setError(null);
    const res = await fetch(`/api/ap/units/${unit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: unit.completedAt === null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong");
    }
    startTransition(() => router.refresh());
    setPending(null);
  }

  if (courses.length === 0) {
    return (
      <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center">
        <GraduationCap className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="font-semibold text-gray-700">No courses loaded yet</p>
        <p className="text-sm text-gray-500 mt-1">
          The unit lists come from the College Board CEDs and are seeded by a migration.
        </p>
      </div>
    );
  }

  const allUnits = courses.flatMap((c) => c.units);

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div className="bg-gray-900 text-white rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Across all courses</p>
          <p className="text-2xl font-bold mt-0.5">
            {doneCount(allUnits)} <span className="text-gray-500">/ {allUnits.length} units</span>
          </p>
        </div>
        <div className="flex-1 min-w-48 max-w-md">
          <Bar done={doneCount(allUnits)} total={allUnits.length} dark />
        </div>
      </div>

      {groupBySeries(courses).map((group) =>
        group.courses.length > 1 ? (
          <SeriesGroup key={group.key} group={group} onToggle={toggle} pending={pending} />
        ) : (
          <CourseCard key={group.key} course={group.courses[0]} onToggle={toggle} pending={pending} />
        )
      )}
    </div>
  );
}

/** Physics C: two exams, one continuously-numbered framework. */
function SeriesGroup({
  group,
  onToggle,
  pending,
}: {
  group: { series: string | null; courses: ApCourseRow[] };
  onToggle: (unit: ApUnitRow) => void;
  pending: string | null;
}) {
  const units = group.courses.flatMap((c) => c.units);
  const numbers = units.map((u) => u.number);

  return (
    <div className="border border-gray-300 rounded-xl bg-gray-100/70 p-3 space-y-3">
      <div className="flex items-center justify-between gap-4 px-2 pt-1 flex-wrap">
        <div>
          <h3 className="font-bold text-gray-900">{group.series}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Two exams, one framework — units run {Math.min(...numbers)}–{Math.max(...numbers)} straight through.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 tabular-nums">
            {doneCount(units)}/{units.length}
          </span>
          <div className="w-28">
            <Bar done={doneCount(units)} total={units.length} />
          </div>
        </div>
      </div>
      {group.courses.map((course) => (
        <CourseCard key={course.id} course={course} onToggle={onToggle} pending={pending} />
      ))}
    </div>
  );
}

function CourseCard({
  course,
  onToggle,
  pending,
}: {
  course: ApCourseRow;
  onToggle: (unit: ApUnitRow) => void;
  pending: string | null;
}) {
  const done = doneCount(course.units);

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-gray-100 flex-wrap">
        <h3 className="font-semibold text-gray-900">{course.name}</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 tabular-nums">
            {done}/{course.units.length}
          </span>
          <div className="w-28">
            <Bar done={done} total={course.units.length} />
          </div>
        </div>
      </div>

      {course.units.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-400">No units loaded for this course yet.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {course.units.map((unit) => {
            const isDone = unit.completedAt !== null;
            return (
              <li key={unit.id}>
                <button
                  onClick={() => onToggle(unit)}
                  disabled={pending === unit.id}
                  aria-pressed={isDone}
                  className="w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <span
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isDone ? "bg-emerald-500 border-emerald-500" : "border-gray-300 bg-white"
                    }`}
                  >
                    {isDone && <Check className="w-3.5 h-3.5 text-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`text-sm ${isDone ? "text-gray-400 line-through" : "text-gray-900"}`}>
                      <span className="text-gray-400 tabular-nums mr-2">Unit {unit.number}</span>
                      {unit.title}
                    </span>
                    {unit.completedAt && (
                      <span className="block text-[11px] text-emerald-600 mt-0.5">
                        finished {unit.completedAt.slice(0, 10)}
                      </span>
                    )}
                  </span>
                  {unit.weighting && (
                    <span className="text-[11px] text-gray-400 tabular-nums flex-shrink-0 mt-0.5">
                      {unit.weighting}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Bar({ done, total, dark = false }: { done: number; total: number; dark?: boolean }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className={`h-2 rounded-full overflow-hidden ${dark ? "bg-white/15" : "bg-gray-200"}`}>
      <div
        className={`h-full rounded-full transition-all ${done === total && total > 0 ? "bg-emerald-500" : "bg-sky-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
