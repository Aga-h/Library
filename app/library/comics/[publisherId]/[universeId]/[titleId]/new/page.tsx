export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import IssueForm from "@/components/comics/IssueForm";

interface PageProps {
  params: Promise<{ publisherId: string; universeId: string; titleId: string }>;
}

export default async function NewIssuePage({ params }: PageProps) {
  const { publisherId, universeId, titleId } = await params;

  const title = await db.comicTitle.findUnique({
    where: { id: titleId },
    include: {
      universe: true,
      issues: { orderBy: { issueNumber: "desc" }, take: 1, select: { issueNumber: true } },
    },
  });
  if (!title || title.universeId !== universeId || title.universe.publisherId !== publisherId) {
    notFound();
  }

  const base = `/library/comics/${publisherId}/${universeId}/${titleId}`;
  // Prefill one past the highest existing issue so adding a run is mostly Enter-pressing.
  const highest = title.issues[0]?.issueNumber;
  const suggestedNumber = highest === undefined ? "1" : String(Math.floor(highest) + 1);

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={base}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to {title.name}
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Add Issue</h1>
        <p className="text-sm text-gray-500 mb-6">To {title.name}</p>
        <IssueForm
          mode="create"
          titleId={title.id}
          redirectTo={base}
          suggestedNumber={suggestedNumber}
        />
      </div>
    </div>
  );
}
