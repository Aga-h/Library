import Image from "next/image";
import { Film } from "lucide-react";
import { TMDB_NOTICE } from "@/lib/tmdb";
import { GB_NOTICE, GB_NOTICE_HREF } from "@/lib/google-books";

/** A search-result poster thumbnail, straight from the source's CDN (TMDB or MyAnimeList). */
export function Poster({ src }: { src: string | null }) {
  return (
    <div className="relative flex-shrink-0 w-9 h-[54px] rounded bg-gray-100 overflow-hidden flex items-center justify-center">
      {src ? <Image fill unoptimized src={src} alt="" className="object-cover" sizes="36px" /> : <Film className="w-4 h-4 text-gray-300" />}
    </div>
  );
}

/** A text-only button (All, None): a 40px-tall hit area on phones, without moving anything. */
export const tinyButtonCls = "font-semibold text-gray-600 hover:text-gray-900 max-sm:py-3 max-sm:-my-3 max-sm:px-2.5 max-sm:-mx-2.5";

/** The All · None pair those sit in — further apart on phones, so their hit areas don't overlap. */
export const tinyButtonsCls = "flex gap-3 max-sm:gap-5";

/** A result's title: whole on a phone (titles that differ only at the end must be told apart), one line from sm. */
export const resultTitleCls = "text-sm font-semibold text-gray-900 max-sm:break-words sm:truncate";

/**
 * A result row's text and its button. From sm they sit side by side, as always; on a phone the
 * title gets the whole width and the button drops under it, beside the year. Put the title and
 * the year in a `resultTextCls` block (dissolved on phones) and give the title `resultWideCls`.
 */
export const resultBodyCls = "flex-1 min-w-0 max-sm:grid max-sm:grid-cols-[1fr_auto] max-sm:gap-y-1 sm:flex items-center gap-x-3";
export const resultTextCls = "max-sm:contents sm:flex-1 sm:min-w-0";
export const resultWideCls = "max-sm:col-span-2 max-sm:min-w-0";

/**
 * A report that appears above the list after a tap far down it: scrolled into view when it
 * mounts (below a phone's top bar — the page's scroll-padding keeps it clear). Use as
 * `ref={reveal}` with `revealCls`, a little room above it.
 */
export function reveal(el: HTMLElement | null) {
  if (!el) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
}
export const revealCls = "scroll-mt-3";

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

/** MyAnimeList's attribution: its API license asks that it be credited as the source. */
export function MalNotice({ className = "", kind = "Anime" }: { className?: string; kind?: "Anime" | "Manga" }) {
  return (
    <p className={`text-[11px] text-gray-400 ${className}`}>
      {kind} data from{" "}
      <a href="https://myanimelist.net" target="_blank" rel="noreferrer" className="underline">MyAnimeList</a>,
      through the official MyAnimeList API.
    </p>
  );
}

/** Google Books' attribution, on Add Book and the book page. */
export function GbNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] text-gray-400 ${className}`}>
      {GB_NOTICE}{" "}
      <a href={GB_NOTICE_HREF} target="_blank" rel="noreferrer" className="underline">books.google.com</a>.
    </p>
  );
}

export function CatalogNotice({ className = "" }: { className?: string }) {
  return <GbNotice className={className} />;
}
