import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stopSession, syncTasks } from "@/lib/task-service";

type RouteContext = { params: Promise<{ id: string }> };

/** Leave the session, banking the time worked so far. */
export async function POST(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const now = new Date();

  const task = await db.task.findUnique({ where: { id }, include: { module: true, sessions: true } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  await stopSession(task, now);
  // The window may have closed while the session was running.
  await syncTasks(now);

  const updated = await db.task.findUnique({ where: { id }, include: { module: true, sessions: true } });
  return NextResponse.json(updated);
}
