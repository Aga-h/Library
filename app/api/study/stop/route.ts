import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { stopStudySession } from "@/lib/task-service";

/** End the running study session and pay its stats. */
async function POSTHandler() {
  const session = await stopStudySession(new Date());
  if (!session) return NextResponse.json({ error: "No study session is running" }, { status: 400 });
  return NextResponse.json(session);
}

export const POST = withErrors(POSTHandler);
