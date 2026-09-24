import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { DEFAULT_RUN_LENGTH } from "@/lib/vocab";
import { startRun } from "@/lib/vocab-service";

// `limit` left out asks about every meaning in the list.
const schema = z.object({ limit: z.number().int().positive().max(10_000).optional() });

/** Take the test (again): builds and shuffles a fresh set, which clears the three categories. */
async function POSTHandler(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }

  const run = await startRun(result.data.limit ?? DEFAULT_RUN_LENGTH);
  if (!run) return NextResponse.json({ error: "Import some words first" }, { status: 400 });
  return NextResponse.json(run, { status: 201 });
}

export const POST = withErrors(POSTHandler);
