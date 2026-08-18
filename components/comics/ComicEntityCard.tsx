import Link from "next/link";
import Image from "next/image";
import { BookOpen } from "lucide-react";

interface Props {
  href: string;
  name: string;
  coverImage: string | null;
  subtitle?: string | null;
  /** e.g. "3 universes · 12 comics" */
  meta?: string | null;
  progress?: { read: number; total: number } | null;
  rating?: number | null;
}

export default function ComicEntityCard({
  href, name, coverImage, subtitle, meta, progress, rating,
}: Props) {
  const pct = progress && progress.total > 0
    ? Math.round((progress.read / progress.total) * 100)
    : 0;

  return (
    <Link
      href={href}
      className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 hover:shadow-md transition-all"
    >
      <div className="relative bg-gray-100 aspect-[2/3] flex items-center justify-center overflow-hidden">
        {coverImage ? (
          <Image
            fill
            src={coverImage}
            alt={name}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,(max-width:1280px) 25vw,20vw"
          />
        ) : (
          <BookOpen className="w-12 h-12 text-gray-300" />
        )}
      </div>

      <div className="flex flex-col gap-1 p-4 flex-1">
        <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug">{name}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        {meta && <p className="text-xs text-gray-400">{meta}</p>}

        {progress && progress.total > 0 && (
          <div className="mt-auto pt-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>{progress.read}/{progress.total} read</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {progress && progress.total === 0 && (
          <p className="text-xs text-gray-400 mt-auto pt-3">No issues yet</p>
        )}

        {rating != null && (
          <div className="flex items-center gap-1 mt-1 text-xs text-amber-500 font-semibold">
            ★ {rating}/10
          </div>
        )}
      </div>
    </Link>
  );
}
