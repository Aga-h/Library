export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText, Clock, Globe, ExternalLink, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { calculateArticleTime, formatReadingTime } from "@/lib/reading-time";
import { LANGUAGE_CONFIG, type LanguageKey } from "@/lib/constants/languages";
import DeleteArticleButton from "@/components/articles/DeleteArticleButton";

interface PageProps { params: Promise<{ id: string }> }

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  READ:         { label: "Read",          className: "bg-green-100 text-green-700" },
  WANT_TO_READ: { label: "Want to Read",  className: "bg-amber-100 text-amber-700" },
};

export default async function ArticleDetailPage({ params }: PageProps) {
  const { id } = await params;
  const article = await db.article.findUnique({ where: { id } });
  if (!article) notFound();

  const status = STATUS_STYLES[article.status] ?? STATUS_STYLES.WANT_TO_READ;
  const langLabel = LANGUAGE_CONFIG[article.language as LanguageKey]?.label ?? article.language;
  const timeRead = formatReadingTime(calculateArticleTime(article.wordCount, article.language as LanguageKey).minutes * (article.timesReread + 1));

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/library/articles" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 py-2.5 -mt-2.5 mb-3.5 sm:py-0 sm:mt-0 sm:mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4 shrink-0" /> Back to Articles
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex gap-4 sm:gap-6 p-5 sm:p-8 sm:pb-6">
          <div className="flex-shrink-0 w-20 h-28 sm:w-28 sm:h-40 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
            {article.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={article.coverImage} alt={article.title} className="w-full h-full object-cover" />
            ) : (
              <FileText className="w-10 h-10 text-gray-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 leading-snug break-words">{article.title}</h1>
                {article.publication && <p className="text-gray-400 text-sm font-medium">{article.publication}</p>}
                {article.author && <p className="text-gray-500 mt-1">{article.author}</p>}
                {article.url && (
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline py-2.5 -mb-1.5 sm:py-0 sm:mb-0 sm:mt-1">
                    <ExternalLink className="w-3 h-3" /> Read article
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2 flex-shrink-0">
                <Link href={`/library/articles/${article.id}/edit`} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Link>
                <DeleteArticleButton articleId={article.id} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>{status.label}</span>
              {article.rating !== null && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">★ {article.rating}/10</span>}
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 grid grid-cols-3 divide-x divide-y divide-gray-100">
          <DetailCell icon={<FileText className="w-4 h-4" />} label="Word Count" value={`${article.wordCount.toLocaleString()} words`} />
          <DetailCell icon={<Clock className="w-4 h-4" />} label="Read Time" value={timeRead} />
          <DetailCell icon={<Globe className="w-4 h-4" />} label="Language" value={langLabel} />
        </div>
        {article.notes && (
          <div className="px-5 pb-5 sm:px-8 sm:pb-8 pt-6 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{article.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 flex flex-col items-center justify-center gap-1 p-3 sm:p-4 text-center">
      <div className="text-gray-400">{icon}</div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-bold text-gray-800 max-w-full break-words">{value}</p>
    </div>
  );
}
