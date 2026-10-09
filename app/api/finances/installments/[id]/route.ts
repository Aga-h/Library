import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, withErrors } from "@/lib/api-errors";
import { isNotFound } from "@/lib/prisma-errors";

type Ctx = { params: Promise<{ id: string }> };

// Moves a purchase to the other card. Every installment moves with it, past ones too: carryover is
// replayed from the purchase as it is now, like every edit to a subscription.
const patchSchema = z.object({ source: z.enum(["BASE", "EXTRA"]) });

async function PATCHHandler(request: Request, { params }: Ctx) {
  const { id } = await params;
  const result = patchSchema.safeParse(await readJson(request));
  if (!result.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  try {
    const installment = await db.installment.update({ where: { id }, data: { source: result.data.source } });
    revalidateTag("finance-stats", { expire: 0 });
    return NextResponse.json(installment);
  } catch (e) {
    if (isNotFound(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}

/** Removes the purchase and every installment of it — from past months' balances too. */
async function DELETEHandler(_request: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await db.installment.delete({ where: { id } });
  } catch (e) {
    if (isNotFound(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
  revalidateTag("finance-stats", { expire: 0 });
  return NextResponse.json({ success: true });
}

export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
