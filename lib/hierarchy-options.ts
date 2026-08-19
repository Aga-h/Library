import { db } from "@/lib/db";
import type { HierarchyOption } from "@/components/ui/HierarchySelect";

// Type-only import — erased at compile time, so this server module never drags the
// client component across the bundle boundary (nor `pg` the other way).

const PARENTED = { id: true, name: true, universe: { select: { id: true, name: true } } } as const;
const PARENTED_ORDER = [{ universe: { name: "asc" as const } }, { name: "asc" as const }];

type ParentedRow = { id: string; name: string; universe: { id: string; name: string } | null };

/**
 * Standalone entries sort first. Postgres puts NULLs last on an ascending sort and Prisma's
 * `nulls` option does not apply to a relation `orderBy`, so unparented rows sank to the
 * bottom of every picker — exactly the ones worth offering when filing something.
 */
const standaloneFirst = (a: HierarchyOption, b: HierarchyOption) =>
  Number(a.parentName !== null) - Number(b.parentName !== null) ||
  (a.parentName ?? "").localeCompare(b.parentName ?? "") ||
  a.name.localeCompare(b.name);

const shape = (rows: ParentedRow[]): HierarchyOption[] =>
  rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      parentName: r.universe?.name ?? null,
      parentId: r.universe?.id ?? null,
    }))
    .sort(standaloneFirst);

// Leaf entries hang off a series rather than a universe, and their display name is `title`.
type LeafRow = { id: string; title: string; series: { id: string; name: string } | null };

const LEAF = { id: true, title: true, series: { select: { id: true, name: true } } } as const;
const LEAF_ORDER = [{ series: { name: "asc" as const } }, { title: "asc" as const }];

const shapeLeaf = (rows: LeafRow[]): HierarchyOption[] =>
  rows
    .map((r) => ({
      id: r.id,
      name: r.title,
      parentName: r.series?.name ?? null,
      parentId: r.series?.id ?? null,
    }))
    .sort(standaloneFirst);

// Nothing sits above a universe, so both parent fields are always null.
const shapeRoot = (rows: { id: string; name: string }[]): HierarchyOption[] =>
  rows.map((r) => ({ ...r, parentName: null, parentId: null }));

const ROOT = { id: true, name: true } as const;
const ROOT_ORDER = { name: "asc" as const };

/* ── Series, for picking a leaf's parent ─────────────────────────────────── */

export async function tvSeriesOptions(): Promise<HierarchyOption[]> {
  return shape(await db.tvSeries.findMany({ select: PARENTED, orderBy: PARENTED_ORDER }));
}

export async function animeSeriesOptions(): Promise<HierarchyOption[]> {
  return shape(await db.animeSeries.findMany({ select: PARENTED, orderBy: PARENTED_ORDER }));
}

export async function bookSeriesOptions(): Promise<HierarchyOption[]> {
  return shape(await db.bookSeries.findMany({ select: PARENTED, orderBy: PARENTED_ORDER }));
}

/* ── Universes, for picking a series' parent ─────────────────────────────── */

export async function tvUniverseOptions(): Promise<HierarchyOption[]> {
  return shapeRoot(await db.tvUniverse.findMany({ select: ROOT, orderBy: ROOT_ORDER }));
}

export async function animeUniverseOptions(): Promise<HierarchyOption[]> {
  return shapeRoot(await db.animeUniverse.findMany({ select: ROOT, orderBy: ROOT_ORDER }));
}

export async function bookUniverseOptions(): Promise<HierarchyOption[]> {
  return shapeRoot(await db.bookUniverse.findMany({ select: ROOT, orderBy: ROOT_ORDER }));
}

export async function movieUniverseOptions(): Promise<HierarchyOption[]> {
  return shapeRoot(await db.movieUniverse.findMany({ select: ROOT, orderBy: ROOT_ORDER }));
}

/* ── Leaf entries, for attaching an existing one to a parent ─────────────── */

export async function tvShowOptions(): Promise<HierarchyOption[]> {
  return shapeLeaf(await db.tvShow.findMany({ select: LEAF, orderBy: LEAF_ORDER }));
}

export async function animeTitleOptions(): Promise<HierarchyOption[]> {
  return shapeLeaf(await db.anime.findMany({ select: LEAF, orderBy: LEAF_ORDER }));
}

export async function bookTitleOptions(): Promise<HierarchyOption[]> {
  return shapeLeaf(await db.book.findMany({ select: LEAF, orderBy: LEAF_ORDER }));
}

// Movies have no series tier — a film hangs directly off a universe.
export async function movieTitleOptions(): Promise<HierarchyOption[]> {
  const rows = await db.movie.findMany({
    select: { id: true, title: true, universe: { select: { id: true, name: true } } },
    orderBy: [{ universe: { name: "asc" } }, { title: "asc" }],
  });
  return rows
    .map((r) => ({
      id: r.id,
      name: r.title,
      parentName: r.universe?.name ?? null,
      parentId: r.universe?.id ?? null,
    }))
    .sort(standaloneFirst);
}
