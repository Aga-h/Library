export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import DayPlanForm from "@/components/calendar/DayPlanForm";
import DeleteEntityButton from "@/components/ui/DeleteEntityButton";

function toHHMM(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

interface PageProps { params: Promise<{ id: string }> }

export default async function EditDayPage({ params }: PageProps) {
  const { id } = await params;
  const plan = await db.dayPlan.findUnique({
    where: { id },
    include: { activities: { orderBy: { startMinute: "asc" } }, _count: { select: { days: true } } },
  });
  if (!plan) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/calendar/days" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Days
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="text-xl font-bold text-gray-900">Edit Day</h1>
          <DeleteEntityButton
            apiPath={`/api/calendar/days/${plan.id}`}
            redirectTo="/calendar/days"
            warning={plan._count.days > 0
              ? `This day is on ${plan._count.days} ${plan._count.days === 1 ? "date" : "dates"}. Those dates stay, but go back to being empty.`
              : undefined}
          />
        </div>
        <DayPlanForm
          mode="edit"
          planId={plan.id}
          initial={{
            name: plan.name,
            kind: plan.kind,
            notes: plan.notes ?? "",
            activities: plan.activities.map((a) => ({
              title: a.title,
              start: toHHMM(a.startMinute),
              end: a.endMinute != null ? toHHMM(a.endMinute) : "",
              notes: a.notes ?? "",
            })),
          }}
        />
      </div>
    </div>
  );
}
