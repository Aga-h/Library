export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import TitleForm from "@/components/comics/TitleForm";

interface PageProps {
  params: Promise<{ publisherId: string; universeId: string }>;
}

export default async function NewTitlePage({ params }: PageProps) {
  const { publisherId, universeId } = await params;

  const universe = await db.comicUniverse.findUnique({ where: { id: universeId } });
  if (!universe || universe.publisherId !== publisherId) notFound();

  const base = `/library/comics/${publisherId}/${universeId}`;

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={base}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to {universe.name}
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Add Comic</h1>
        <p className="text-sm text-gray-500 mb-6">In {universe.name}</p>
        <TitleForm
          mode="create"
          universeId={universe.id}
          redirectTo={base}
        />
      </div>
    </div>
  );
}
