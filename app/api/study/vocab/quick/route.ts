import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { QUICK_POOLS } from "@/lib/vocab";
import { startQuickRun } from "@/lib/vocab-service";

const schema = z.object({
  pool: z.enum(QUICK_POOLS),
  size: z.number().int().min(1).max(200),
});

/** Start a quick test from one pool. The full test and its three lists are left alone. */
async function POSTHandler(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  const run = await startQuickRun(parsed.data.pool, parsed.data.size);
  if (!run) return NextResponse.json({ error: "Nothing in that pool yet." }, { status: 400 });
  return NextResponse.json(run, { status: 201 });
}

export const POST = withErrors(POSTHandler);
