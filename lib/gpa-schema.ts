// The body of a lesson, shared by the create and update routes. Zod stays out of lib/gpa.ts
// so the calculator, which runs in the browser, does not carry it.

import { z } from "zod";
import {
  MARK_ERROR,
  MARK_KEYS,
  NAME_ERROR,
  NAME_MAX,
  HOURS_ERROR,
  blankMarks,
  parseHoursValue,
  parseMarkValue,
  type LessonBody,
} from "@/lib/gpa";

const lessonBodySchema = z.object({
  name: z.string().min(1, NAME_ERROR).max(NAME_MAX, "Keep the name under 80 characters."),
  hours: z.number(),
  h1Exam1: z.number().nullable(),
  h1Perf1: z.number().nullable(),
  h1Exam2: z.number().nullable(),
  h1Perf2: z.number().nullable(),
  h1Project: z.number().nullable(),
  h2Exam1: z.number().nullable(),
  h2Perf1: z.number().nullable(),
  h2Exam2: z.number().nullable(),
  h2Perf2: z.number().nullable(),
  h2Project: z.number().nullable(),
});

export function readLessonBody(value: unknown): { ok: true; body: LessonBody } | { ok: false; error: string } {
  const parsed = lessonBodySchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };

  const name = parsed.data.name.trim();
  if (!name) return { ok: false, error: NAME_ERROR };
  if (name.length > NAME_MAX) return { ok: false, error: "Keep the name under 80 characters." };

  const hours = parseHoursValue(parsed.data.hours);
  if (hours === undefined) return { ok: false, error: HOURS_ERROR };

  const marks = blankMarks();
  for (const key of MARK_KEYS) {
    const mark = parseMarkValue(parsed.data[key]);
    if (mark === undefined) return { ok: false, error: MARK_ERROR };
    marks[key] = mark;
  }
  return { ok: true, body: { name, hours, ...marks } };
}
