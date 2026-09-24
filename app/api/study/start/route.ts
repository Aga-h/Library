import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { startSession } from "@/lib/study-service";
import { isDateKey, todayKey, type DateKey } from "@/lib/dates";

const schema = z.object({
  /** The module being studied. Left out or null, the session rolls three stats at random. */
  moduleId: z.string().min(1).nullable().optional(),
  date: z.string().refine(isDateKey, "Expected a YYYY-MM-DD date").optional(),
});

/** Begin studying. */
async function POSTHandler(request: NextRequest) {
  const now = new Date();
  const body = await request.json().catch(() => ({}));
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }

  const date = (result.data.date ?? todayKey(now)) as DateKey;
  const started = await startSession(date, result.data.moduleId ?? null, now);

  if (!started.ok) {
    const message = started.reason === "unknown-module"
      ? "That module no longer exists"
      : "That module trains no stats, so it would pay nothing";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json(started.session, { status: 201 });
}

export const POST = withErrors(POSTHandler);
