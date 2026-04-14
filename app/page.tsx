export const dynamic = "force-dynamic";

import Link from "next/link";
import { BookOpen, Film, Tv2, Gamepad2, BookMarked, Layers, Newspaper, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";

function c(groups: { status: string; _count: { _all: number } }[], status: string) {
  return groups.find((g) => g.status === status)?._count._all ?? 0;
}

export default async function HomePage() {
  const [books, anime, movies, tvShows, games, manga, comics, articles] = await Promise.all([
    db.book.groupBy({ by: ["status"], _count: { _all: true } }),
    db.anime.groupBy({ by: ["status"], _count: { _all: true } }),
    db.movie.groupBy({ by: ["status"], _count: { _all: true } }),
    db.tvShow.groupBy({ by: ["status"], _count: { _all: true } }),
    db.game.groupBy({ by: ["status"], _count: { _all: true } }),
    db.manga.groupBy({ by: ["status"], _count: { _all: true } }),
    db.comic.groupBy({ by: ["status"], _count: { _all: true } }),
    db.article.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const total = (groups: { status: string; _count: { _all: number } }[]) =>
    groups.reduce((s, g) => s + g._count._all, 0);

  const SECTIONS = [
    {
      href: "/books", label: "Books", icon: BookOpen,
      color: "from-blue-50 to-indigo-50 border-blue-200", iconColor: "text-blue-600",
      stats: [{ label: "Total", value: total(books) }, { label: "Read", value: c(books, "READ") }, { label: "Reading", value: c(books, "READING") }],
    },
    {
      href: "/anime", label: "Anime", icon: Layers,
      color: "from-pink-50 to-rose-50 border-pink-200", iconColor: "text-pink-500",
      stats: [{ label: "Total", value: total(anime) }, { label: "Completed", value: c(anime, "COMPLETED") }, { label: "Watching", value: c(anime, "WATCHING") }],
    },
    {
      href: "/movies", label: "Movies", icon: Film,
      color: "from-purple-50 to-violet-50 border-purple-200", iconColor: "text-purple-500",
      stats: [{ label: "Total", value: total(movies) }, { label: "Watched", value: c(movies, "WATCHED") }, { label: "Remaining", value: c(movies, "WANT_TO_WATCH") }],
    },
    {
      href: "/tv", label: "TV Shows", icon: Tv2,
      color: "from-orange-50 to-amber-50 border-orange-200", iconColor: "text-orange-500",
      stats: [{ label: "Total", value: total(tvShows) }, { label: "Completed", value: c(tvShows, "COMPLETED") }, { label: "Watching", value: c(tvShows, "WATCHING") }],
    },
    {
      href: "/games", label: "Games", icon: Gamepad2,
      color: "from-green-50 to-emerald-50 border-green-200", iconColor: "text-green-500",
      stats: [{ label: "Total", value: total(games) }, { label: "Completed", value: c(games, "COMPLETED") }, { label: "Playing", value: c(games, "PLAYING") }],
    },
    {
      href: "/manga", label: "Manga", icon: BookMarked,
      color: "from-cyan-50 to-sky-50 border-cyan-200", iconColor: "text-cyan-500",
      stats: [{ label: "Total", value: total(manga) }, { label: "Completed", value: c(manga, "COMPLETED") }, { label: "Reading", value: c(manga, "READING") }],
    },
    {
      href: "/comics", label: "Comics", icon: BookMarked,
      color: "from-yellow-50 to-lime-50 border-yellow-200", iconColor: "text-yellow-600",
      stats: [{ label: "Total", value: total(comics) }, { label: "Completed", value: c(comics, "COMPLETED") }, { label: "Reading", value: c(comics, "READING") }],
    },
    {
      href: "/articles", label: "Articles", icon: Newspaper,
      color: "from-gray-50 to-slate-50 border-gray-200", iconColor: "text-gray-500",
      stats: [{ label: "Total", value: total(articles) }, { label: "Read", value: c(articles, "READ") }, { label: "Queued", value: c(articles, "WANT_TO_READ") }],
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Your personal media library</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}
              className={`group relative bg-gradient-to-br ${section.color} border rounded-xl p-5 hover:shadow-md transition-all`}>
              <div className="flex items-center justify-between mb-3">
                <Icon className={`w-5 h-5 ${section.iconColor}`} />
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="font-semibold text-gray-800 mb-3">{section.label}</p>
              <div className="flex gap-4">
                {section.stats.map((stat) => (
                  <div key={stat.label}>
                    <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
