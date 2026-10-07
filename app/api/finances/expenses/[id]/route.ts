import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, withErrors } from "@/lib/api-errors";
import { isNotFound } from "@/lib/prisma-errors";

// Only the pot can change: an expense filed under the wrong card is moved with a tap.
const patchSchema = z.object({ source: z.enum(["BASE", "EXTRA"]) });

async function PATCHHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = patchSchema.safeParse(await readJson(request));
  if (!result.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  try {
    const expense = await db.expense.update({ where: { id }, data: { source: result.data.source } });
    revalidateTag("finance-stats", { expire: 0 });
    return NextResponse.json(expense);
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
  await db.expense.delete({ where: { id } });
  revalidateTag("finance-stats", { expire: 0 });
  return NextResponse.json({ success: true });
}

export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
