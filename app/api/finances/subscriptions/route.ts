import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

export async function GET() {
  const subscriptions = await db.subscription.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(subscriptions);
}

const createSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  startYear: z.number().int(),
  startMonth: z.number().int().min(1).max(12),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = createSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const subscription = await db.subscription.create({ data: result.data });
  revalidateTag("finance-stats", "max");
  return NextResponse.json(subscription, { status: 201 });
}
