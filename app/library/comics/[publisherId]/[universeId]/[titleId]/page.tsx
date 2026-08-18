export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { summarizeIssues, pluralize } from "@/lib/comics";
import { calculateComicTime } from "@/lib/reading-time";
import { LANGUAGE_CONFIG, type LanguageKey } from "@/lib/constants/languages";
import ComicBreadcrumb from "@/components/comics/ComicBreadcrumb";
import ComicLevelStats from "@/components/comics/ComicLevelStats";
import IssueRow from "@/components/comics/IssueRow";
import DeleteComicEntityButton from "@/components/comics/DeleteComicEntityButton";

interface PageProps {
  params: Promise<{ publisherId: string; universeId: string; titleId: string }>;
}

export default async function TitlePage({ params }: PageProps) {
  const { publisherId, universeId, titleId } = await params;

  const title = await db.comicTitle.findUnique({
    where: { id: titleId },
    include: {
      universe: { include: { publisher: true } },
      issues: { orderBy: { issueNumber: "asc" } },
    },
  });
  if (!title || title.universeId !== universeId || title.universe.publisherId !== publisherId) {
    notFound();
  }

  const base = `/library/comics/${publisherId}/${universeId}/${titleId}`;
  const progress = summarizeIssues(title.issues);
  const ownedCount = title.issues.filter((i) => i.owned).length;
  const langLabel = LANGUAGE_CONFIG[title.language as LanguageKey]?.label ?? title.language;

  return (
    <div>
      <ComicBreadcrumb
        crumbs={[
          { label: title.universe.publisher.name, href: `/library/comics/${publisherId}` },
          { label: title.universe.name, href: `/library/comics/${publisherId}/${universeId}` },
          { label: title.name },
        ]}
      />

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {[title.author, title.artist && title.artist !== title.author ? `Art by ${title.artist}` : null, langLabel]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-start gap-2 flex-shrink-0">
          <Link
            href={`${base}/edit`}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
          <DeleteComicEntityButton
            apiPath={`/api/comics/titles/${title.id}`}
            redirectTo={`/library/comics/${publisherId}/${universeId}`}
            warning={
              progress.total > 0
                ? `This also deletes ${pluralize(progress.total, "issue")}.`
                : undefined
            }
          />
          <Link
            href={`${base}/new`}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Issue
          </Link>
        </div>
      </div>

      <ComicLevelStats
        heading={`${title.name} Stats`}
        stats={[
          { label: "Issues", value: progress.total },
          { label: "Read", value: progress.read },
          { label: "Owned", value: ownedCount },
          { label: "Rereads", value: progress.rereads },
        ]}
        issuesRead={progress.read}
        minutes={calculateComicTime(progress.readUnits, title.language as LanguageKey).minutes}
      />

      {title.notes && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{title.notes}</p>
        </div>
      )}

      {title.issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No issues yet</p>
          <p className="text-gray-400 text-sm mt-1">Add issue #1 to start tracking this run.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {title.issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} href={`${base}/${issue.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
