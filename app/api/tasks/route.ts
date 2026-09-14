import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { syncTasks } from "@/lib/task-service";
import { addDaysToKey, isDayKey, localToDate } from "@/lib/time";

const schema = z.object({
  moduleId: z.string().min(1),
  day: z.string().refine(isDayKey, "Expected a YYYY-MM-DD day"),
  startMinutes: z.number().int().min(0).max(1439),
  endMinutes: z.number().int().min(1).max(2880),
  title: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
  /** Also book the same slot on the following weeks. */
  repeatWeeks: z.number().int().min(1).max(52).default(1),
});

export async function GET(request: NextRequest) {
  await syncTasks();
  const { searchParams } = new URL(request.url);
  const day = searchParams.get("day");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where = day
    ? { day }
    : from && to
      ? { day: { gte: from, lte: to } }
      : {};

  const tasks = await db.task.findMany({
    where,
    include: { module: true, sessions: true },
    orderBy: { startsAt: "asc" },
  });
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const d = result.data;

  if (d.endMinutes <= d.startMinutes) {
    return NextResponse.json({ error: "The end time has to be after the start time" }, { status: 400 });
  }
  if (d.endMinutes > 1440) {
    return NextResponse.json(
      { error: "A task has to finish by midnight — book the rest as a second task on the next day" },
      { status: 400 },
    );
  }

  const mod = await db.module.findUnique({ where: { id: d.moduleId } });
  if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  const created = [];
  for (let week = 0; week < d.repeatWeeks; week++) {
    const day = addDaysToKey(d.day, week * 7);
    created.push(
      await db.task.create({
        data: {
          moduleId: mod.id,
          day,
          startsAt: localToDate(day, d.startMinutes),
          endsAt: localToDate(day, d.endMinutes),
          title: d.title?.trim() || null,
          notes: d.notes?.trim() || null,
        },
        include: { module: true, sessions: true },
      }),
    );
  }

  return NextResponse.json(created.length === 1 ? created[0] : created, { status: 201 });
}
