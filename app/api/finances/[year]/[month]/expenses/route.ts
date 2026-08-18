import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseMonthParams } from "@/lib/month-params";
import { withErrors } from "@/lib/api-errors";

const expenseSchema = z.object({
  // Optional client-generated id. When present it makes the POST idempotent, so the
  // offline queue can retry safely without ever creating a duplicate expense.
  clientId: z.string().min(1).max(64).optional(),
  category: z.enum(["FOOD", "BOOKS", "EDUCATION", "ENTERTAINMENT", "CLOTHING", "SUBSCRIPTIONS", "SELF_CARE", "TRANSPORTATION", "OTHER", "CASH"]),
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
  const result = expenseSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }

  const data = {
    year,
    month,
    category: result.data.category,
    amount: result.data.amount,
    description: result.data.description ?? null,
    clientId: result.data.clientId ?? null,
  };

  // Idempotent when a clientId is supplied: a replayed POST returns the row that already
  // exists rather than inserting a second one. Concurrent syncs, a second tab, and retries
  // after a lost response all collapse to a single expense.
  const expense = result.data.clientId
    ? await db.expense.upsert({
        where: { clientId: result.data.clientId },
        create: data,
        update: {},
      })
    : await db.expense.create({ data });

  revalidateTag("finance-stats", "max");
  return NextResponse.json(expense, { status: 201 });
}

export const POST = withErrors(POSTHandler);
