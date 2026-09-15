import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";
import { bankOtherSessions, syncTasks } from "@/lib/task-service";
import { isFinal, openSession } from "@/lib/tasks";

type RouteContext = { params: Promise<{ id: string }> };

/** Enter a session on this task. Any session running elsewhere is banked first. */
async function POSTHandler(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const now = new Date();
  await syncTasks(now);

  const task = await db.task.findUnique({ where: { id }, include: { module: true, sessions: true } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (isFinal(task)) return NextResponse.json({ error: "This task has already been judged" }, { status: 400 });
  if (now < task.startsAt) return NextResponse.json({ error: "This task hasn't started yet" }, { status: 400 });
  if (now >= task.endsAt) return NextResponse.json({ error: "This task's window has closed" }, { status: 400 });
  if (openSession(task.sessions)) return NextResponse.json(task);

  await bankOtherSessions(id, now);
  await db.taskSession.create({ data: { taskId: id, startedAt: now } });

  const updated = await db.task.update({
    where: { id },
    data: { status: "ACTIVE" },
    include: { module: true, sessions: true },
  });
  return NextResponse.json(updated);
}

export const POST = withErrors(POSTHandler);
