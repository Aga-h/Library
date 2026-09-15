import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";
import { DAY_KIND_VALUES } from "@/lib/constants/enums";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  kind: z.enum(DAY_KIND_VALUES),
  notes: z.string().optional(),
});

async function GETHandler() {
  return NextResponse.json(
    await db.dayPlan.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      include: { activities: { orderBy: { startMinute: "asc" } } },
    })
  );
}

async function POSTHandler(request: NextRequest) {
  const result = createSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const name = result.data.name.trim();
  try {
    const plan = await db.dayPlan.create({
      data: { name, kind: result.data.kind, notes: result.data.notes || null },
    });
    revalidateTag("calendar", "max");
    return NextResponse.json(plan, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ error: `A ${result.data.kind.toLowerCase()} day named "${name}" already exists` }, { status: 409 });
    }
    throw e;
  }
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
