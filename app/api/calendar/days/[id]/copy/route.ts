import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Names are unique per kind, so a copy cannot reuse the original's. Walks "(copy)",
 * "(copy 2)", "(copy 3)" … until one is free, rather than failing and making the user rename
 * something before they can duplicate it.
 */
function freeName(sourceName: string, taken: Set<string>): string {
  // Copying a copy should give "(copy 3)", not "(copy 2) (copy)". Strip any existing suffix
  // first so the names stay readable however many times you duplicate.
  const base = sourceName.replace(/ \(copy(?: \d+)?\)$/, "");
  const first = `${base} (copy)`;
  if (!taken.has(first)) return first;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} (copy ${n})`;
    if (!taken.has(candidate)) return candidate;
  }
  // 999 copies of one day is not a real scenario, but silently overwriting would be worse.
  throw new Error(`Could not find a free name for a copy of "${base}"`);
}

async function POSTHandler(_r: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const source = await db.dayPlan.findUnique({
    where: { id },
    include: { activities: { orderBy: { startMinute: "asc" } } },
  });
  if (!source) return NextResponse.json({ error: "Day not found" }, { status: 404 });

  const siblings = await db.dayPlan.findMany({
    where: { kind: source.kind },
    select: { name: true },
  });
  const name = freeName(source.name, new Set(siblings.map((s) => s.name)));

  try {
    // The copy is a new plan of the same kind with the same timetable. It is deliberately NOT
    // dealt onto any date — copying a day should not silently change the calendar.
    const copy = await db.dayPlan.create({
      data: {
        name,
        kind: source.kind,
        notes: source.notes,
        activities: {
          create: source.activities.map((a) => ({
            title: a.title,
            startMinute: a.startMinute,
            endMinute: a.endMinute,
            notes: a.notes,
          })),
        },
      },
      include: { activities: { orderBy: { startMinute: "asc" } } },
    });
    revalidateTag("calendar", "max");
    return NextResponse.json(copy, { status: 201 });
  } catch (e) {
    // Only reachable if another copy was created between the name check and the insert.
    if (isUniqueViolation(e)) {
      return NextResponse.json({ error: "That name was taken just now — try again" }, { status: 409 });
    }
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
