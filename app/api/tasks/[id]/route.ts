import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isFinal } from "@/lib/tasks";
import { isDayKey, localToDate } from "@/lib/time";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  day: z.string().refine(isDayKey, "Expected a YYYY-MM-DD day").optional(),
  startMinutes: z.number().int().min(0).max(1439).optional(),
  endMinutes: z.number().int().min(1).max(2880).optional(),
  title: z.string().max(80).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  moduleId: z.string().min(1).optional(),
});

export async function GET(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const task = await db.task.findUnique({ where: { id }, include: { module: true, sessions: true } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const d = result.data;

  const task = await db.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (isFinal(task) && (d.day || d.startMinutes !== undefined || d.endMinutes !== undefined)) {
    return NextResponse.json({ error: "A judged task can't be rescheduled" }, { status: 400 });
  }

  const day = d.day ?? task.day;
  const reslot = d.day !== undefined || d.startMinutes !== undefined || d.endMinutes !== undefined;
  let startsAt = task.startsAt;
  let endsAt = task.endsAt;

  if (reslot) {
    const startMinutes = d.startMinutes ?? minutesBetween(task.day, task.startsAt);
    const endMinutes = d.endMinutes ?? minutesBetween(task.day, task.endsAt);
    if (endMinutes <= startMinutes) {
      return NextResponse.json({ error: "The end time has to be after the start time" }, { status: 400 });
    }
    if (endMinutes > 1440) {
      return NextResponse.json(
        { error: "A task has to finish by midnight — book the rest as a second task on the next day" },
        { status: 400 },
      );
    }
    startsAt = localToDate(day, startMinutes);
    endsAt = localToDate(day, endMinutes);
  }

  const updated = await db.task.update({
    where: { id },
    data: {
      day,
      startsAt,
      endsAt,
      ...(d.title !== undefined ? { title: d.title?.trim() || null } : {}),
      ...(d.notes !== undefined ? { notes: d.notes?.trim() || null } : {}),
      ...(d.moduleId !== undefined ? { moduleId: d.moduleId } : {}),
    },
    include: { module: true, sessions: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  await db.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

/** Minutes past local midnight of `day` for an instant already on that day. */
function minutesBetween(day: string, at: Date): number {
  const midnight = localToDate(day, 0);
  return Math.round((at.getTime() - midnight.getTime()) / 60000);
}
