import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";

const createPublisherSchema = z.object({
  name: z.string().min(1, "Name is required"),
  coverImage: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});

async function GETHandler() {
  const publishers = await db.comicPublisher.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(publishers);
}

async function POSTHandler(request: NextRequest) {
  const body = await request.json();
  const result = createPublisherSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const name = data.name.trim();

  try {
    const publisher = await db.comicPublisher.create({
      data: {
        name,
        coverImage: data.coverImage || null,
        notes: data.notes || null,
      },
    });
    revalidateTag("library-stats", "max");
    return NextResponse.json(publisher, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json(
        { error: `A publisher named "${name}" already exists` },
        { status: 409 }
      );
    }
    throw e;
  }
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
