import { db } from "@/lib/db";
import { MARK_KEYS, announcedKeys, blankMarks, type GpaLesson, type LessonBody } from "@/lib/gpa";
import { isMissingColumn, isMissingTable, isNotFound } from "@/lib/prisma-errors";

type Row = {
  id: string;
  name: string;
  hours: number;
  position: number;
  announced?: string[] | null;
} & Record<(typeof MARK_KEYS)[number], number | null>;

/** Every column but `announced`, for a database migration 043 hasn't reached yet. */
const BEFORE_043 = {
  id: true,
  name: true,
  hours: true,
  position: true,
  ...Object.fromEntries(MARK_KEYS.map((key) => [key, true])),
} as { id: true; name: true; hours: true; position: true } & Record<(typeof MARK_KEYS)[number], true>;

/** The body without `announced`, for writes that leave that column alone. */
function withoutAnnounced(body: LessonBody): Omit<LessonBody, "announced"> {
  const data: Omit<LessonBody, "announced"> = { name: body.name, hours: body.hours, ...blankMarks() };
  for (const key of MARK_KEYS) data[key] = body[key];
  return data;
}

export function toGpaLesson(row: Row): GpaLesson {
  const lesson: GpaLesson = {
    id: row.id, name: row.name, hours: row.hours, position: row.position, announced: [], ...blankMarks(),
  };
  for (const key of MARK_KEYS) lesson[key] = row[key];
  const known = new Set<string>(MARK_KEYS);
  lesson.announced = announcedKeys((row.announced ?? []).filter((key) => known.has(key)) as GpaLesson["announced"], lesson);
  return lesson;
}

/**
 * Every lesson, in the order they were added. Null until migration 040 has run. `announcing`
 * is false until 043 has: every mark is then a prediction.
 */
export async function listGpaLessons(): Promise<{ lessons: GpaLesson[]; announcing: boolean } | null> {
  const orderBy = [{ position: "asc" as const }, { id: "asc" as const }];
  try {
    const rows = await db.gpaLesson.findMany({ orderBy });
    return { lessons: rows.map(toGpaLesson), announcing: true };
  } catch (e) {
    if (isMissingTable(e)) return null;
    if (!isMissingColumn(e)) throw e;
  }
  const rows = await db.gpaLesson.findMany({ orderBy, select: BEFORE_043 });
  return { lessons: rows.map(toGpaLesson), announcing: false };
}

/** A new lesson has no marks, so nothing is announced; `announced` is left to its default. */
export async function createGpaLesson(body: LessonBody): Promise<GpaLesson> {
  const last = await db.gpaLesson.findFirst({ orderBy: { position: "desc" }, select: { position: true } });
  const row = await db.gpaLesson.create({
    data: { ...withoutAnnounced(body), position: (last?.position ?? 0) + 1 },
    select: BEFORE_043,
  });
  return toGpaLesson(row);
}

/**
 * Null when the lesson was already deleted. Before 043, a save that announces nothing still goes
 * through; one that announces a mark throws the missing-column error for the route to report.
 */
export async function updateGpaLesson(id: string, body: LessonBody): Promise<GpaLesson | null> {
  try {
    try {
      return toGpaLesson(await db.gpaLesson.update({ where: { id }, data: body }));
    } catch (e) {
      if (!isMissingColumn(e) || body.announced.length > 0) throw e;
    }
    const data = withoutAnnounced(body);
    return toGpaLesson(await db.gpaLesson.update({ where: { id }, data, select: BEFORE_043 }));
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

/** False when it was already gone. */
export async function deleteGpaLesson(id: string): Promise<boolean> {
  try {
    await db.gpaLesson.delete({ where: { id }, select: { id: true } });
    return true;
  } catch (e) {
    if (isNotFound(e)) return false;
    throw e;
  }
}
