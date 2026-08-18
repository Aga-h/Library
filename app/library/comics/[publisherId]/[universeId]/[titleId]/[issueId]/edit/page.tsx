export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { formatIssueNumber } from "@/lib/comics";
import IssueForm from "@/components/comics/IssueForm";

interface PageProps {
  params: Promise<{ publisherId: string; universeId: string; titleId: string; issueId: string }>;
}

export default async function EditIssuePage({ params }: PageProps) {
  const { publisherId, universeId, titleId, issueId } = await params;

  const issue = await db.comicIssue.findUnique({
    where: { id: issueId },
    include: { comicTitle: { include: { universe: true } } },
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
      <Link
        href={`${base}/${issue.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to {label}
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Edit Issue</h1>
        <p className="text-sm text-gray-500 mb-6">
          {label} — {issue.comicTitle.name}
        </p>
        <IssueForm
          mode="edit"
          titleId={titleId}
          issueId={issue.id}
          redirectTo={base}
          initialData={{
            issueNumber: String(issue.issueNumber),
            name: issue.name ?? "",
            read: issue.read,
            owned: issue.owned,
            rating: issue.rating?.toString() ?? "",
            // <input type="date"> needs a bare YYYY-MM-DD string, not an ISO timestamp.
            releaseDate: issue.releaseDate ? issue.releaseDate.toISOString().slice(0, 10) : "",
            coverImage: issue.coverImage ?? "",
            notes: issue.notes ?? "",
          }}
        />
      </div>
    </div>
  );
}
