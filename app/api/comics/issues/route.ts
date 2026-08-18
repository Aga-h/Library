import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";

const createIssueSchema = z.object({
  titleId: z.string().min(1, "Comic is required"),
  issueNumber: z.number(),
  name: z.string().optional(),
  read: z.boolean().default(false),
  owned: z.boolean().default(false),
  coverImage: z.string().url().optional().or(z.literal("")),
  rating: z.number().min(1).max(10).optional(),
  releaseDate: z.string().optional(),
  timesReread: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const titleId = searchParams.get("titleId");

  const issues = await db.comicIssue.findMany({
    where: titleId ? { titleId } : {},
    orderBy: { issueNumber: "asc" },
  });
  return NextResponse.json(issues);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = createIssueSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  const title = await db.comicTitle.findUnique({ where: { id: data.titleId } });
  if (!title) {
    return NextResponse.json({ error: "Comic not found" }, { status: 404 });
  }

  const releaseDate = data.releaseDate ? new Date(data.releaseDate) : null;
  if (releaseDate && Number.isNaN(releaseDate.getTime())) {
    return NextResponse.json({ error: "Release date is not a valid date" }, { status: 400 });
  }

  try {
    const issue = await db.comicIssue.create({
      data: {
        titleId: data.titleId,
        issueNumber: data.issueNumber,
        name: data.name || null,
        read: data.read,
        owned: data.owned,
        coverImage: data.coverImage || null,
        rating: data.rating ?? null,
        releaseDate,
        timesReread: data.timesReread,
        notes: data.notes || null,
      },
    });
    revalidateTag("library-stats", "max");
    return NextResponse.json(issue, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json(
        { error: `Issue #${data.issueNumber} already exists in ${title.name}` },
        { status: 409 }
      );
    }
    throw e;
  }
}
