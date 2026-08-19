import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  // Optional: a series with no universe lives on the TV main page.
  universeId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

async function GETHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const universeId = searchParams.get("universeId");
  return NextResponse.json(
    await db.tvSeries.findMany({
      where: universeId ? { universeId } : {},
      orderBy: { name: "asc" },
    })
  );
}

async function POSTHandler(request: NextRequest) {
  const result = createSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const { universeId, notes } = result.data;
  const name = result.data.name.trim();

  if (universeId && !(await db.tvUniverse.findUnique({ where: { id: universeId } }))) {
    return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  }

  try {
    const series = await db.tvSeries.create({
      data: { name, universeId: universeId || null, notes: notes || null },
    });
    revalidateTag("library-stats", "max");
    return NextResponse.json(series, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ error: `A series named "${name}" already exists here` }, { status: 409 });
    }
    throw e;
  }
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
