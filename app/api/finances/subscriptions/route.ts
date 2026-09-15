import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";

async function GETHandler() {
  const subscriptions = await db.subscription.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(subscriptions);
}

const createSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  startYear: z.number().int(),
  startMonth: z.number().int().min(1).max(12),
});

async function POSTHandler(request: NextRequest) {
  const body = await request.json();
  const result = createSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const subscription = await db.subscription.create({ data: result.data });
  revalidateTag("finance-stats", "max");
  return NextResponse.json(subscription, { status: 201 });
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
