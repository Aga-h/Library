import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";

async function GETHandler() {
  const config = await db.financeConfig.upsert({
    where: { id: "global" },
    create: { id: "global", monthlyBudget: 0 },
    update: {},
  });
  return NextResponse.json(config);
}

const deltaSchema = z.object({ delta: z.number() });

async function POSTHandler(request: NextRequest) {
  const body = await request.json();
  const result = deltaSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }

  const config = await db.financeConfig.upsert({
    where: { id: "global" },
    create: { id: "global", monthlyBudget: result.data.delta },
    update: { monthlyBudget: { increment: result.data.delta } },
  });

  revalidateTag("finance-stats", "max");
  return NextResponse.json(config);
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
