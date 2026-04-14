export const dynamic = "force-dynamic";

import Link from "next/link";
import { BookOpen, Film, Tv2, Gamepad2, BookMarked, Layers, Newspaper, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";

export default async function HomePage() {
  const [
    totalBooks, readBooks, readingBooks,
    totalAnime, completedAnime, watchingAnime,
    totalMovies, watchedMovies,
    totalTv, completedTv, watchingTv,
    totalGames, completedGames, playingGames,
    totalManga, completedManga, readingManga,
    totalComics, completedComics,
    totalArticles, readArticles,
  ] = await Promise.all([
    db.book.count(), db.book.count({ where: { status: "READ" } }), db.book.count({ where: { status: "READING" } }),
    db.anime.count(), db.anime.count({ where: { status: "COMPLETED" } }), db.anime.count({ where: { status: "WATCHING" } }),
    db.movie.count(), db.movie.count({ where: { status: "WATCHED" } }),
    db.tvShow.count(), db.tvShow.count({ where: { status: "COMPLETED" } }), db.tvShow.count({ where: { status: "WATCHING" } }),
    db.game.count(), db.game.count({ where: { status: "COMPLETED" } }), db.game.count({ where: { status: "PLAYING" } }),
    db.manga.count(), db.manga.count({ where: { status: "COMPLETED" } }), db.manga.count({ where: { status: "READING" } }),
    db.comic.count(), db.comic.count({ where: { status: "COMPLETED" } }),
    db.article.count(), db.article.count({ where: { status: "READ" } }),
  ]);

  const SECTIONS = [
    {
      href: "/books", label: "Books", icon: BookOpen,
      color: "from-blue-50 to-indigo-50 border-blue-200", iconColor: "text-blue-600",
      stats: [{ label: "Total", value: totalBooks }, { label: "Read", value: readBooks }, { label: "Reading", value: readingBooks }],
    },
    {
      href: "/anime", label: "Anime", icon: Layers,
      color: "from-pink-50 to-rose-50 border-pink-200", iconColor: "text-pink-500",
      stats: [{ label: "Total", value: totalAnime }, { label: "Completed", value: completedAnime }, { label: "Watching", value: watchingAnime }],
    },
    {
      href: "/movies", label: "Movies", icon: Film,
      color: "from-purple-50 to-violet-50 border-purple-200", iconColor: "text-purple-500",
      stats: [{ label: "Total", value: totalMovies }, { label: "Watched", value: watchedMovies }, { label: "Remaining", value: totalMovies - watchedMovies }],
    },
    {
      href: "/tv", label: "TV Shows", icon: Tv2,
      color: "from-orange-50 to-amber-50 border-orange-200", iconColor: "text-orange-500",
      stats: [{ label: "Total", value: totalTv }, { label: "Completed", value: completedTv }, { label: "Watching", value: watchingTv }],
    },
    {
      href: "/games", label: "Games", icon: Gamepad2,
      color: "from-green-50 to-emerald-50 border-green-200", iconColor: "text-green-500",
      stats: [{ label: "Total", value: totalGames }, { label: "Completed", value: completedGames }, { label: "Playing", value: playingGames }],
    },
    {
      href: "/manga", label: "Manga", icon: BookMarked,
      color: "from-cyan-50 to-sky-50 border-cyan-200", iconColor: "text-cyan-500",
      stats: [{ label: "Total", value: totalManga }, { label: "Completed", value: completedManga }, { label: "Reading", value: readingManga }],
    },
    {
      href: "/comics", label: "Comics", icon: BookMarked,
      color: "from-yellow-50 to-lime-50 border-yellow-200", iconColor: "text-yellow-600",
      stats: [{ label: "Total", value: totalComics }, { label: "Completed", value: completedComics }],
    },
    {
      href: "/articles", label: "Articles", icon: Newspaper,
      color: "from-gray-50 to-slate-50 border-gray-200", iconColor: "text-gray-500",
      stats: [{ label: "Total", value: totalArticles }, { label: "Read", value: readArticles }, { label: "Queued", value: totalArticles - readArticles }],
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
