import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";

const createUniverseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  publisherId: z.string().min(1, "Publisher is required"),
  coverImage: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});

async function GETHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const publisherId = searchParams.get("publisherId");

  const universes = await db.comicUniverse.findMany({
    where: publisherId ? { publisherId } : {},
    orderBy: { name: "asc" },
  });
  return NextResponse.json(universes);
}

async function POSTHandler(request: NextRequest) {
  const body = await request.json();
  const result = createUniverseSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const name = data.name.trim();

  const publisher = await db.comicPublisher.findUnique({ where: { id: data.publisherId } });
  if (!publisher) {
    return NextResponse.json({ error: "Publisher not found" }, { status: 404 });
  }

  try {
    const universe = await db.comicUniverse.create({
      data: {
        name,
        publisherId: data.publisherId,
        coverImage: data.coverImage || null,
        notes: data.notes || null,
      },
    });
    revalidateTag("library-stats", "max");
    return NextResponse.json(universe, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json(
        { error: `A universe named "${name}" already exists under ${publisher.name}` },
        { status: 409 }
      );
    }
    throw e;
  }
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
