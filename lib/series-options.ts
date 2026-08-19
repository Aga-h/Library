import { db } from "@/lib/db";
import type { SeriesOption } from "@/components/ui/SeriesSelect";

// Type-only import — erased at compile time, so this server module never drags the
// client component across the bundle boundary (nor `pg` the other way).

const SELECT = { id: true, name: true, universe: { select: { name: true } } } as const;
const ORDER = [{ universe: { name: "asc" as const } }, { name: "asc" as const }];

type Row = { id: string; name: string; universe: { name: string } | null };

const shape = (rows: Row[]): SeriesOption[] =>
  rows.map((r) => ({ id: r.id, name: r.name, universeName: r.universe?.name ?? null }));

export async function tvSeriesOptions(): Promise<SeriesOption[]> {
  return shape(await db.tvSeries.findMany({ select: SELECT, orderBy: ORDER }));
}

export async function animeSeriesOptions(): Promise<SeriesOption[]> {
  return shape(await db.animeSeries.findMany({ select: SELECT, orderBy: ORDER }));
}
