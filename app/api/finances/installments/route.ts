import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, withErrors } from "@/lib/api-errors";
import { MAX_INSTALLMENTS, MIN_INSTALLMENTS } from "@/lib/installments";

async function GETHandler() {
  const installments = await db.installment.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(installments);
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  /** The whole price; each month's share is derived from it. */
  total: z.number().positive().max(1_000_000_000),
  count: z.number().int().min(MIN_INSTALLMENTS).max(MAX_INSTALLMENTS),
  startYear: z.number().int().min(2000).max(2100),
  startMonth: z.number().int().min(1).max(12),
  source: z.enum(["BASE", "EXTRA"]).optional(),
});

async function POSTHandler(request: NextRequest) {
  const result = createSchema.safeParse(await readJson(request));
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  // Stored to the kuruş, like the installments it is split into.
  const data = { ...result.data, total: Math.round(result.data.total * 100) / 100 };
  const installment = await db.installment.create({ data });
  revalidateTag("finance-stats", { expire: 0 });
  return NextResponse.json(installment, { status: 201 });
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
