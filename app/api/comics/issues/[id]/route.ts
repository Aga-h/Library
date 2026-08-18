import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";

const updateIssueSchema = z.object({
  issueNumber: z.number().optional(),
  name: z.string().optional().nullable(),
  read: z.boolean().optional(),
  owned: z.boolean().optional(),
  coverImage: z.string().url().optional().nullable().or(z.literal("")),
  rating: z.number().min(1).max(10).optional().nullable(),
  releaseDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const issue = await db.comicIssue.findUnique({ where: { id } });
  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }
  return NextResponse.json(issue);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const issue = await db.comicIssue.findUnique({ where: { id } });
  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = updateIssueSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  let releaseDate: Date | null | undefined;
  if (data.releaseDate !== undefined) {
    releaseDate = data.releaseDate ? new Date(data.releaseDate) : null;
    if (releaseDate && Number.isNaN(releaseDate.getTime())) {
      return NextResponse.json({ error: "Release date is not a valid date" }, { status: 400 });
    }
  }

  try {
    const updated = await db.comicIssue.update({
      where: { id },
      data: {
        ...(data.issueNumber !== undefined ? { issueNumber: data.issueNumber } : {}),
        ...(data.name !== undefined ? { name: data.name || null } : {}),
        ...(data.read !== undefined ? { read: data.read } : {}),
        ...(data.owned !== undefined ? { owned: data.owned } : {}),
        ...(data.coverImage !== undefined ? { coverImage: data.coverImage || null } : {}),
        ...(data.rating !== undefined ? { rating: data.rating ?? null } : {}),
        ...(releaseDate !== undefined ? { releaseDate } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      },
    });
    revalidateTag("library-stats", "max");
    return NextResponse.json(updated);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json(
        { error: `Issue #${data.issueNumber} already exists in this comic` },
        { status: 409 }
      );
    }
    throw e;
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const issue = await db.comicIssue.findUnique({ where: { id } });
  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  await db.comicIssue.delete({ where: { id } });
  revalidateTag("library-stats", "max");
  return new NextResponse(null, { status: 204 });
}
