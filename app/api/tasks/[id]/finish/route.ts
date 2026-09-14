import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatDuration } from "@/lib/time";
import { settle } from "@/lib/task-service";
import { isFinal, requiredSeconds, workedSecondsNow } from "@/lib/tasks";

type RouteContext = { params: Promise<{ id: string }> };

/** Close a task out early. Only allowed once the completion bar has been cleared. */
export async function POST(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const now = new Date();

  const task = await db.task.findUnique({ where: { id }, include: { module: true, sessions: true } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (isFinal(task)) return NextResponse.json(task);

  const worked = workedSecondsNow(task, now);
  const required = requiredSeconds(task);
  if (worked < required) {
    return NextResponse.json(
      { error: `Not there yet — ${formatDuration(required - worked)} left before this counts as done` },
      { status: 400 },
    );
  }

  await settle(task, now);
  const updated = await db.task.findUnique({ where: { id }, include: { module: true, sessions: true } });
  return NextResponse.json(updated);
}
