import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, withErrors } from "@/lib/api-errors";
import { isNotFound } from "@/lib/prisma-errors";

// Moves a subscription to the other pot. Its whole history moves with it: carryover is replayed
// from the subscription as it is now, like every other edit to a subscription.
const patchSchema = z.object({ source: z.enum(["BASE", "EXTRA"]) });

async function PATCHHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = patchSchema.safeParse(await readJson(request));
  if (!result.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  try {
    const subscription = await db.subscription.update({ where: { id }, data: { source: result.data.source } });
    revalidateTag("finance-stats", { expire: 0 });
    return NextResponse.json(subscription);
  } catch (e) {
    if (isNotFound(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}

async function DELETEHandler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.subscription.delete({ where: { id } });
  revalidateTag("finance-stats", { expire: 0 });
  return NextResponse.json({ success: true });
}

export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
