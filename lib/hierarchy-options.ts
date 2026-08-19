import { db } from "@/lib/db";
import type { HierarchyOption } from "@/components/ui/HierarchySelect";

// Type-only import — erased at compile time, so this server module never drags the
// client component across the bundle boundary (nor `pg` the other way).

const SELECT = { id: true, name: true, universe: { select: { name: true } } } as const;
const ORDER = [{ universe: { name: "asc" as const } }, { name: "asc" as const }];

type Row = { id: string; name: string; universe: { name: string } | null };

const shape = (rows: Row[]): HierarchyOption[] =>
  rows.map((r) => ({ id: r.id, name: r.name, parentName: r.universe?.name ?? null }));

export async function tvSeriesOptions(): Promise<HierarchyOption[]> {
  return shape(await db.tvSeries.findMany({ select: SELECT, orderBy: ORDER }));
}

export async function animeSeriesOptions(): Promise<HierarchyOption[]> {
  return shape(await db.animeSeries.findMany({ select: SELECT, orderBy: ORDER }));
}

export async function bookSeriesOptions(): Promise<HierarchyOption[]> {
  return shape(await db.bookSeries.findMany({ select: SELECT, orderBy: ORDER }));
}

// Movies stop at the universe level, so there is no parent above it to prefix with.
export async function movieUniverseOptions(): Promise<HierarchyOption[]> {
  const rows = await db.movieUniverse.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return rows.map((r) => ({ ...r, parentName: null }));
}
