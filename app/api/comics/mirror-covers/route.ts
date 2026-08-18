import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SUPABASE_COVER_MARKER, mirrorCover } from "@/lib/covers";
import { withErrors } from "@/lib/api-errors";

const MIRROR_BATCH = 10;

type Pending = { id: string; coverImage: string; folder: string; kind: Kind };
type Kind = "publisher" | "universe" | "title" | "issue";

async function updateCover(kind: Kind, id: string, coverImage: string) {
  const data = { coverImage };
  if (kind === "publisher") return db.comicPublisher.update({ where: { id }, data });
  if (kind === "universe") return db.comicUniverse.update({ where: { id }, data });
  if (kind === "title") return db.comicTitle.update({ where: { id }, data });
  return db.comicIssue.update({ where: { id }, data });
}

async function POSTHandler() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required" },
      { status: 500 }
    );
  }

  // Filter in SQL. Reading all four tables in full to keep 10 rows meant the whole comic
  // library crossed the wire on every click.
  const select = { id: true, coverImage: true };
  const pendingWhere = {
    coverImage: { not: null },
    NOT: { coverImage: { contains: SUPABASE_COVER_MARKER } },
  } as const;
  const opts = { where: pendingWhere, select, take: MIRROR_BATCH };

  const [publishers, universes, titles, issues, counts] = await Promise.all([
    db.comicPublisher.findMany(opts),
    db.comicUniverse.findMany(opts),
    db.comicTitle.findMany(opts),
    db.comicIssue.findMany(opts),
    Promise.all([
      db.comicPublisher.count({ where: pendingWhere }),
      db.comicUniverse.count({ where: pendingWhere }),
      db.comicTitle.count({ where: pendingWhere }),
      db.comicIssue.count({ where: pendingWhere }),
    ]),
  ]);
  const pendingCount = counts.reduce((a, b) => a + b, 0);

  const pending: Pending[] = [
    ...publishers.map((r) => ({ ...r, folder: "comic-publishers", kind: "publisher" as const })),
    ...universes.map((r) => ({ ...r, folder: "comic-universes", kind: "universe" as const })),
    ...titles.map((r) => ({ ...r, folder: "comic-titles", kind: "title" as const })),
    ...issues.map((r) => ({ ...r, folder: "comic-issues", kind: "issue" as const })),
  ].filter((r): r is Pending => !!r.coverImage);

  const batch = pending.slice(0, MIRROR_BATCH);

  let mirrored = 0;
  let lastError: string | null = null;
  await Promise.allSettled(
    batch.map(async (item) => {
      try {
        const newUrl = await mirrorCover(item.coverImage, `${item.folder}/${item.id}.jpg`);
        await updateCover(item.kind, item.id, newUrl);
        mirrored++;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    })
  );

  if (mirrored === 0 && batch.length > 0 && lastError) {
    return NextResponse.json({ error: lastError }, { status: 502 });
  }

  return NextResponse.json({ mirrored, remaining: pendingCount - mirrored });
}

export const POST = withErrors(POSTHandler);
