import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { startRun } from "@/lib/vocab-service";

/** Take the test (again): builds and shuffles a fresh set, which clears the three categories. */
async function POSTHandler() {
  const run = await startRun();
  if (!run) return NextResponse.json({ error: "Import some words first" }, { status: 400 });
  return NextResponse.json(run, { status: 201 });
}

export const POST = withErrors(POSTHandler);
