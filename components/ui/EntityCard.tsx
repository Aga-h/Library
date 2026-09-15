import Link from "next/link";
import Image from "next/image";
import { BookOpen, type LucideIcon } from "lucide-react";

interface Props {
  href: string;
  name: string;
  /** Levels that carry no artwork (publishers, universes, series) omit this entirely and
   *  get a compact text tile instead of an empty 2:3 placeholder. */
  coverImage?: string | null;
  /** Set when the level has images but this row happens to lack one. */
  showCover?: boolean;
  subtitle?: string | null;
  /** e.g. "3 universes · 12 comics" */
  meta?: string | null;
  progress?: { read: number; total: number } | null;
  rating?: number | null;
  icon?: LucideIcon;
  /** Tailwind class for the progress bar fill, e.g. "bg-yellow-500". */
  accentClass?: string;
}

export default function EntityCard({
  href, name, coverImage, showCover = coverImage !== undefined, subtitle, meta,
  progress, rating, icon: Icon = BookOpen, accentClass = "bg-yellow-500",
}: Props) {
  const pct =
    progress && progress.total > 0 ? Math.round((progress.read / progress.total) * 100) : 0;

  return (
    <Link
      href={href}
      className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 hover:shadow-md transition-all"
    >
      {showCover && (
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
            <Icon className="w-12 h-12 text-gray-300" />
          )}
        </div>
      )}

      <div className="flex flex-col gap-1 p-4 flex-1">
        {!showCover && <Icon className="w-5 h-5 text-gray-300 mb-1" />}
        <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug">{name}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        {meta && <p className="text-xs text-gray-400">{meta}</p>}

        {progress && progress.total > 0 && (
          <div className="mt-auto pt-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>{progress.read}/{progress.total}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${accentClass} rounded-full`} style={{ width: `${pct}%` }} />
            </div>
          </div>
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
