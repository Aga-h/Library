import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

const incomeSchema = z.object({
  amount: z.number().positive(),
  description: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const { year: yearStr, month: monthStr } = await params;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

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
