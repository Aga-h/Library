import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseMonthParams } from "@/lib/month-params";
import { withErrors } from "@/lib/api-errors";

const incomeSchema = z.object({
  amount: z.number().positive(),
  description: z.string().optional(),
});

async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const parsed = parseMonthParams(await params);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }
  const { year, month } = parsed;

  const body = await request.json();
  const result = incomeSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }

  const income = await db.additionalIncome.create({
    data: { year, month, ...result.data, description: result.data.description ?? null },
  });

  revalidateTag("finance-stats", "max");
  return NextResponse.json(income, { status: 201 });
}

export const POST = withErrors(POSTHandler);
