// Importing a Comic Vine run into a universe. Server-only.

import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { planMerge, titleNameFor } from "@/lib/comicvine";
import { ComicVineError, volumeWithIssues } from "@/lib/comicvine-service";

export interface ImportResult {
  titleId: string;
  titleName: string;
  /** False when the run landed on a comic that already existed. */
  createdTitle: boolean;
  added: number;
  filled: number;
  skipped: { issueNumber: string; reason: string }[];
  /** Every issue Comic Vine lists for the run. */
  total: number;
}

/**
 * Brings a Comic Vine run into a universe: the comic if it is not there yet, then every issue.
 *
 * It lands on the run imported before if there is one, or on a hand-added comic of the same name —
 * which is then linked, so the next import finds it. Either way the merge only ever adds: see
 * planMerge. Importing the same run twice is therefore how you pick up newly released issues.
 */
export async function importRun(universeId: string, volumeId: number): Promise<ImportResult> {
  const universe = await db.comicUniverse.findUnique({ where: { id: universeId } });
  if (!universe) throw new ComicVineError("Universe not found.", 404);

  const { volume, issues } = await volumeWithIssues(volumeId);
  const name = titleNameFor(volume);

  const findTitle = async () =>
    (await db.comicTitle.findFirst({ where: { universeId, comicVineId: volumeId } })) ??
    (await db.comicTitle.findUnique({ where: { universeId_name: { universeId, name } } }));

  let title = await findTitle();
  if (title && title.comicVineId !== null && title.comicVineId !== volumeId) {
    throw new ComicVineError(`"${name}" already exists here, linked to a different Comic Vine run.`, 409);
  }

  let createdTitle = false;
  if (!title) {
    try {
      title = await db.comicTitle.create({ data: { universeId, name, comicVineId: volumeId } });
      createdTitle = true;
    } catch (e) {
      // Two imports of the same run at once (a double tap): the other one created it — use that.
      if (!isUniqueViolation(e)) throw e;
      title = await findTitle();
      if (!title) throw e;
    }
  } else if (title.comicVineId === null) {
    title = await db.comicTitle.update({ where: { id: title.id }, data: { comicVineId: volumeId } });
  }

  const existing = await db.comicIssue.findMany({
    where: { titleId: title.id },
    select: { id: true, issueNumber: true, name: true, coverImage: true },
  });
  const plan = planMerge(existing, issues);
  const titleId = title.id;

  await db.$transaction([
    db.comicIssue.createMany({
      data: plan.create.map((issue) => ({ titleId, ...issue })),
      // A concurrent import may have added some already; the (title, number) key keeps one each.
      skipDuplicates: true,
    }),
    ...plan.fill.map(({ id, ...data }) => db.comicIssue.update({ where: { id }, data })),
  ]);

  return {
    titleId,
    titleName: title.name,
    createdTitle,
    added: plan.create.length,
    filled: plan.fill.length,
    skipped: plan.skipped,
    total: issues.length,
  };
}
