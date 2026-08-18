import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseMonthParams } from "@/lib/month-params";

const expenseSchema = z.object({
  category: z.enum(["FOOD", "BOOKS", "EDUCATION", "ENTERTAINMENT", "CLOTHING", "SUBSCRIPTIONS", "SELF_CARE", "TRANSPORTATION", "OTHER", "CASH"]),
  amount: z.number().positive(),
  description: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const parsed = parseMonthParams(await params);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }
  const { year, month } = parsed;

  const body = await request.json();
  const result = expenseSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }

  const expense = await db.expense.create({
    data: { year, month, ...result.data, description: result.data.description ?? null },
  });

  revalidateTag("finance-stats", "max");
  return NextResponse.json(expense, { status: 201 });
}
