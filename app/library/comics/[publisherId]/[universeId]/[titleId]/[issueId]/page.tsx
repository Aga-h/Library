export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, Pencil, Calendar, Check, Package, Repeat } from "lucide-react";
import { db } from "@/lib/db";
import { formatIssueNumber } from "@/lib/comics";
import Breadcrumb from "@/components/ui/Breadcrumb";
import DeleteEntityButton from "@/components/ui/DeleteEntityButton";

interface PageProps {
  params: Promise<{ publisherId: string; universeId: string; titleId: string; issueId: string }>;
}

export default async function IssueDetailPage({ params }: PageProps) {
  const { publisherId, universeId, titleId, issueId } = await params;

  const issue = await db.comicIssue.findUnique({
    where: { id: issueId },
    include: { comicTitle: { include: { universe: { include: { publisher: true } } } } },
  });
  if (
    !issue ||
    issue.titleId !== titleId ||
    issue.comicTitle.universeId !== universeId ||
    issue.comicTitle.universe.publisherId !== publisherId
  ) {
    notFound();
  }

  const base = `/library/comics/${publisherId}/${universeId}/${titleId}`;
  const label = formatIssueNumber(issue.issueNumber);

  return (
    <div className="max-w-2xl mx-auto">
      <Breadcrumb
        rootHref="/library/comics"
        rootLabel="Comics"
        crumbs={[
          { label: issue.comicTitle.universe.publisher.name, href: `/library/comics/${publisherId}` },
          { label: issue.comicTitle.universe.name, href: `/library/comics/${publisherId}/${universeId}` },
          { label: issue.comicTitle.name, href: base },
          { label },
        ]}
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex gap-6 p-8 pb-6">
          <div className="relative flex-shrink-0 w-28 h-40 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
            {issue.coverImage ? (
              <Image fill src={issue.coverImage} alt={label} className="object-cover" sizes="112px" />
            ) : (
              <BookOpen className="w-10 h-10 text-gray-300" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-snug">{label}</h1>
                {issue.name && <p className="text-gray-500 mt-1">{issue.name}</p>}
                <p className="text-gray-400 text-sm mt-1">{issue.comicTitle.name}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href={`${base}/${issue.id}/edit`}
                  className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Link>
                <DeleteEntityButton
                  apiPath={`/api/comics/issues/${issue.id}`}
                  redirectTo={base}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <span
                className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  issue.read ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                <Check className="w-3 h-3" /> {issue.read ? "Read" : "Unread"}
              </span>
              <span
                className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  issue.owned ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                <Package className="w-3 h-3" /> {issue.owned ? "Owned" : "Not owned"}
              </span>
              {issue.rating !== null && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
                  ★ {issue.rating}/10
                </span>
              )}
              {issue.timesReread > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                  <Repeat className="w-3 h-3" /> Reread {issue.timesReread}×
                </span>
              )}
              {issue.releaseDate && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                  <Calendar className="w-3 h-3" />
                  {issue.releaseDate.toISOString().slice(0, 10)}
                </span>
              )}
            </div>
          </div>
        </div>

        {issue.notes && (
          <div className="p-8 pt-6 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{issue.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
