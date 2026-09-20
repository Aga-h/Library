export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import ApTracker from "@/components/tasks/ApTracker";

export default async function ApPage() {
  const courses = await db.apCourse.findMany({
    orderBy: { position: "asc" },
    include: { units: { orderBy: { number: "asc" } } },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">APs</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Units as College Board lists them in each Course and Exam Description. Tick one off when
          you have finished it.
        </p>
      </div>
      <ApTracker
        courses={courses.map((c) => ({
          id: c.id,
          name: c.name,
          shortName: c.shortName,
          units: c.units.map((u) => ({
            id: u.id,
            number: u.number,
            title: u.title,
            weighting: u.weighting,
            completedAt: u.completedAt ? u.completedAt.toISOString() : null,
          })),
        }))}
      />
    </div>
  );
}
