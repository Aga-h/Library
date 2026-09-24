import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { stopSession } from "@/lib/study-service";

/** End the running session and pay its stats. */
async function POSTHandler() {
  const session = await stopSession();
  if (!session) return NextResponse.json({ error: "Nothing is running" }, { status: 400 });
  return NextResponse.json(session);
}

export const POST = withErrors(POSTHandler);
