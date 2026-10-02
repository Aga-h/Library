import Image from "next/image";
import { Film } from "lucide-react";
import { TMDB_NOTICE } from "@/lib/tmdb";

/** A search-result poster thumbnail, straight from TMDB's CDN. */
export function Poster({ src }: { src: string | null }) {
  return (
    <div className="relative flex-shrink-0 w-9 h-[54px] rounded bg-gray-100 overflow-hidden flex items-center justify-center">
      {src ? <Image fill unoptimized src={src} alt="" className="object-cover" sizes="36px" /> : <Film className="w-4 h-4 text-gray-300" />}
    </div>
  );
}

/** TMDB's required attribution: its notice and its logo, wherever its data is used. */
export function TmdbNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-start gap-2 text-[11px] text-gray-400 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/tmdb-logo.svg" alt="TMDB" className="h-2.5 mt-0.5 flex-shrink-0" />
      <span>{TMDB_NOTICE}</span>
    </p>
  );
}
