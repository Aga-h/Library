import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  notes: z.string().optional(),
});

async function GETHandler() {
  return NextResponse.json(await db.movieUniverse.findMany({ orderBy: { name: "asc" } }));
}

async function POSTHandler(request: NextRequest) {
  const result = createSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const name = result.data.name.trim();
  try {
    const universe = await db.movieUniverse.create({ data: { name, notes: result.data.notes || null } });
    revalidateTag("library-stats", "max");
    return NextResponse.json(universe, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ error: `A universe named "${name}" already exists` }, { status: 409 });
    }
    throw e;
  }
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
