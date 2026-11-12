import { NextResponse } from "next/server";
import { readJson, withErrors } from "@/lib/api-errors";
import { ANNOUNCED_NOT_READY, GPA_NOT_READY } from "@/lib/gpa";
import { readLessonBody } from "@/lib/gpa-schema";
import { deleteGpaLesson, updateGpaLesson } from "@/lib/gpa-service";
import { isMissingColumn, isMissingTable } from "@/lib/prisma-errors";

type RouteContext = { params: Promise<{ id: string }> };

async function PATCHHandler(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = readLessonBody(await readJson(request));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  try {
    const lesson = await updateGpaLesson(id, result.body);
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    return NextResponse.json(lesson);
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ error: GPA_NOT_READY }, { status: 503 });
    // Only a save that announces a mark gets here before 043.
    if (isMissingColumn(e)) return NextResponse.json({ error: ANNOUNCED_NOT_READY }, { status: 503 });
    throw e;
  }
}

async function DELETEHandler(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const removed = await deleteGpaLesson(id);
    if (!removed) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ error: GPA_NOT_READY }, { status: 503 });
    throw e;
  }
}

export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
