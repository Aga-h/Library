import { db } from "@/lib/db";
import { MARK_KEYS, blankMarks, type GpaLesson, type LessonBody } from "@/lib/gpa";
import { isMissingTable, isNotFound } from "@/lib/prisma-errors";

type Row = {
  id: string;
  name: string;
  hours: number;
  position: number;
} & Record<(typeof MARK_KEYS)[number], number | null>;

export function toGpaLesson(row: Row): GpaLesson {
  const lesson: GpaLesson = { id: row.id, name: row.name, hours: row.hours, position: row.position, ...blankMarks() };
  for (const key of MARK_KEYS) lesson[key] = row[key];
  return lesson;
}

/** Every lesson, in the order they were added. Null until migration 040 has run. */
export async function listGpaLessons(): Promise<GpaLesson[] | null> {
  try {
    const rows = await db.gpaLesson.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
    return rows.map(toGpaLesson);
  } catch (e) {
    if (isMissingTable(e)) return null;
    throw e;
  }
}

export async function createGpaLesson(body: LessonBody): Promise<GpaLesson> {
  const last = await db.gpaLesson.findFirst({ orderBy: { position: "desc" }, select: { position: true } });
  const row = await db.gpaLesson.create({ data: { ...body, position: (last?.position ?? 0) + 1 } });
  return toGpaLesson(row);
}

/** Null when the lesson was already deleted. */
export async function updateGpaLesson(id: string, body: LessonBody): Promise<GpaLesson | null> {
  try {
    return toGpaLesson(await db.gpaLesson.update({ where: { id }, data: body }));
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

/** False when it was already gone. */
export async function deleteGpaLesson(id: string): Promise<boolean> {
  try {
    await db.gpaLesson.delete({ where: { id } });
    return true;
  } catch (e) {
    if (isNotFound(e)) return false;
    throw e;
  }
}
