import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";
import { fromKey, isDateKey } from "@/lib/calendar-dates";

const dateKey = z.string().refine(isDateKey, "Must be a real date (YYYY-MM-DD)");

const createSchema = z.object({
  name: z.string().optional(),
  startDate: dateKey,
  endDate: dateKey,
});

async function GETHandler() {
  return NextResponse.json(await db.schoolTerm.findMany({ orderBy: { startDate: "asc" } }));
}

async function POSTHandler(request: NextRequest) {
  const result = createSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const { name, startDate, endDate } = result.data;
  if (endDate < startDate) {
    return NextResponse.json({ error: "The term ends before it starts" }, { status: 400 });
  }
  const term = await db.schoolTerm.create({
    data: { name: name || null, startDate: fromKey(startDate), endDate: fromKey(endDate) },
  });
  revalidateTag("calendar", "max");
  return NextResponse.json(term, { status: 201 });
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
