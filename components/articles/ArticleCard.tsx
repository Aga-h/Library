import Link from "next/link";
import { FileText, Clock, ExternalLink } from "lucide-react";
import { calculateArticleTime } from "@/lib/reading-time";
import type { LanguageKey } from "@/lib/constants/languages";

interface Article {
  id: string; title: string; author: string | null; status: string;
  wordCount: number; language: string; publication: string | null;
  url: string | null; rating: number | null; timesReread: number;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  READ:          { label: "Read",          className: "bg-green-100 text-green-700" },
  WANT_TO_READ:  { label: "Want to Read",  className: "bg-amber-100 text-amber-700" },
};

export default function ArticleCard({ article }: { article: Article }) {
  const status = STATUS_STYLES[article.status] ?? STATUS_STYLES.WANT_TO_READ;
  const time = calculateArticleTime(article.wordCount, article.language as LanguageKey);

  return (
    <Link href={`/library/articles/${article.id}`} className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 hover:shadow-md transition-all">
      <div className="relative bg-gray-100 aspect-[2/3] flex items-center justify-center overflow-hidden">
        <FileText className="w-12 h-12 text-gray-300" />
        <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${status.className}`}>{status.label}</span>
        {article.url && <ExternalLink className="absolute bottom-2 right-2 w-3.5 h-3.5 text-gray-400" />}
      </div>
      <div className="flex flex-col gap-1 p-4 flex-1">
        <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug">{article.title}</h3>
        {article.publication && <p className="text-xs text-gray-400">{article.publication}</p>}
        {article.author && <p className="text-xs text-gray-500">{article.author}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto pt-3 text-xs text-gray-400">
          <span>{article.wordCount.toLocaleString()} words</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{time.formatted}</span>
        </div>
        {article.rating !== null && <div className="flex items-center gap-1 mt-1 text-xs text-amber-500 font-semibold">★ {article.rating}/10</div>}
        {article.timesReread > 0 && <p className="text-xs text-gray-400 mt-0.5">Reread ×{article.timesReread}</p>}
      </div>
    </Link>
  );
}
