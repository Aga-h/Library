import { db } from "@/lib/db";
import { toKey, type DateKey } from "@/lib/calendar-dates";

/**
 * Server-side calendar reads. Kept out of the route handlers so the month page and the deal
 * endpoint agree on what a date's kind is — the finances section has the same computation
 * duplicated between its page and its API route, and this avoids repeating that.
 */

export interface CalendarContext {
  terms: { startDate: DateKey; endDate: DateKey }[];
  daysOff: Set<DateKey>;
}

export async function loadContext(): Promise<CalendarContext> {
  const [terms, daysOff] = await Promise.all([
    db.schoolTerm.findMany({ select: { startDate: true, endDate: true } }),
    db.dayOff.findMany({ select: { date: true } }),
  ]);
  return {
    terms: terms.map((t) => ({ startDate: toKey(t.startDate), endDate: toKey(t.endDate) })),
    daysOff: new Set(daysOff.map((d) => toKey(d.date))),
  };
}

export async function plansByKind() {
  const plans = await db.dayPlan.findMany({ select: { id: true, kind: true }, orderBy: { name: "asc" } });
  return {
    SCHOOL: plans.filter((p) => p.kind === "SCHOOL").map((p) => p.id),
    HOLIDAY: plans.filter((p) => p.kind === "HOLIDAY").map((p) => p.id),
  };
}
