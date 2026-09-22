import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { startStudySession, syncTasks } from "@/lib/task-service";
import { isDateKey, todayKey, type DateKey } from "@/lib/calendar-dates";

const schema = z.object({ date: z.string().refine(isDateKey, "Expected a YYYY-MM-DD date").optional() });

/** Begin studying with nothing scheduled. Three stats are rolled server-side. */
async function POSTHandler(request: NextRequest) {
  const now = new Date();
  await syncTasks(now);

  const body = await request.json().catch(() => ({}));
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }

  const date = (result.data.date ?? todayKey(now)) as DateKey;
  const session = await startStudySession(date, now);
  return NextResponse.json(session, { status: 201 });
}

export const POST = withErrors(POSTHandler);
