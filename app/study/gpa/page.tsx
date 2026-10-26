export const dynamic = "force-dynamic";

import GpaCalculator from "@/components/study/GpaCalculator";
import { GPA_NOT_READY } from "@/lib/gpa";
import { listGpaLessons } from "@/lib/gpa-service";

export default async function GpaPage() {
  const lessons = await listGpaLessons();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">GPA</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          A half averages the exams, performances and project filled in for a lesson.
          A blank is skipped, not a zero. Each half weights lessons by their hours, and the year
          is the average of the two halves.
        </p>
      </div>
      {lessons === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-700">{GPA_NOT_READY}</p>
        </div>
      ) : (
        <GpaCalculator lessons={lessons} />
      )}
    </div>
  );
}
