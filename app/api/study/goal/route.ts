import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";
import { hoursToMinutes } from "@/lib/goals";
import { weeklyGoalHours } from "@/lib/goal-schema";

const schema = z.object({ hours: weeklyGoalHours });

/** Set or clear the overall weekly study goal. */
async function PUTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const minutes = result.data.hours === null ? null : hoursToMinutes(result.data.hours);
  const config = await db.studyConfig.upsert({
    where: { id: "global" },
    create: { id: "global", weeklyGoalMinutes: minutes },
    update: { weeklyGoalMinutes: minutes },
  });
  return NextResponse.json({ weeklyGoalMinutes: config.weeklyGoalMinutes });
}

export const PUT = withErrors(PUTHandler);
