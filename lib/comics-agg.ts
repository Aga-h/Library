import { db } from "@/lib/db";
import type { TitleAgg } from "@/lib/comics";

/**
 * Aggregate issues per title in SQL. Two grouped queries regardless of issue count, versus
 * transferring every issue row to count them in JS.
 */
export async function issueAggsByTitle(
  where: Record<string, unknown> = {}
): Promise<Map<string, TitleAgg>> {
  const [totals, reads] = await Promise.all([
    db.comicIssue.groupBy({ by: ["titleId"], where, _count: { _all: true } }),
    db.comicIssue.groupBy({
      by: ["titleId"],
      where: { ...where, read: true },
      _count: { _all: true },
      _sum: { timesReread: true },
    }),
  ]);

  const readMap = new Map(
    reads.map((r) => [r.titleId, { count: r._count._all, rereads: r._sum.timesReread ?? 0 }])
  );

  const out = new Map<string, TitleAgg>();
  for (const t of totals) {
    const r = readMap.get(t.titleId) ?? { count: 0, rereads: 0 };
    out.set(t.titleId, {
      total: t._count._all,
      read: r.count,
      // One time unit per pass: the first read plus every reread.
      readUnits: r.count + r.rereads,
      rereads: r.rereads,
    });
  }
  return out;
}
