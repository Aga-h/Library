import { NextResponse } from "next/server";
import { readJson, withErrors } from "@/lib/api-errors";
import { GPA_NOT_READY } from "@/lib/gpa";
import { readLessonBody } from "@/lib/gpa-schema";
import { createGpaLesson } from "@/lib/gpa-service";
import { isMissingTable } from "@/lib/prisma-errors";

/** Add a lesson. Marks start empty; the hours and the name are required. */
async function POSTHandler(request: Request) {
  const result = readLessonBody(await readJson(request));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  try {
    return NextResponse.json(await createGpaLesson(result.body), { status: 201 });
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ error: GPA_NOT_READY }, { status: 503 });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
