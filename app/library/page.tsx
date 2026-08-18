import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import {
  calculateReadingTime, calculateMangaTime, calculateComicTime, calculateArticleTime,
} from "@/lib/reading-time";
import type { LanguageKey } from "@/lib/constants/languages";
import DashboardClient from "@/components/dashboard/DashboardClient";

function c(groups: { status: string; _count: { _all: number } }[], status: string) {
  return groups.find((g) => g.status === status)?._count._all ?? 0;
}

function total(groups: { status: string; _count: { _all: number } }[]) {
  return groups.reduce((s, g) => s + g._count._all, 0);
}

const getDashboardData = unstable_cache(
  async () => {
    const [books, anime, movies, tvShows, games, manga, articles] = await Promise.all([
      db.book.groupBy({ by: ["status"], _count: { _all: true } }),
      db.anime.groupBy({ by: ["status"], _count: { _all: true } }),
      db.movie.groupBy({ by: ["status"], _count: { _all: true } }),
      db.tvShow.groupBy({ by: ["status"], _count: { _all: true } }),
      db.game.groupBy({ by: ["status"], _count: { _all: true } }),
      db.manga.groupBy({ by: ["status"], _count: { _all: true } }),
      db.article.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    // Comics no longer have a status enum — the hierarchy reports scalar counts instead.
    const [comicTitleCount, comicIssueCount, comicReadAgg] = await Promise.all([
      db.comicTitle.count(),
      db.comicIssue.count(),
      db.comicIssue.aggregate({
        where: { read: true },
        _count: { _all: true },
        _sum: { timesReread: true },
      }),
    ]);
    const comicReadCount = comicReadAgg._count._all;
    // One time unit per pass through an issue: the first read plus every reread.
    const comicReadUnits = comicReadCount + (comicReadAgg._sum.timesReread ?? 0);

    const [booksTime, animeTime, watchedMovies, tvTime, gamesAgg, mangaTime, articlesTime] = await Promise.all([
      db.book.findMany({ where: { status: { in: ["READ", "READING"] } }, select: { pages: true, language: true, timesReread: true } }),
      db.anime.findMany({ select: { episodesWatched: true, episodeDuration: true, timesRewatched: true } }),
      db.movie.findMany({ where: { status: "WATCHED" }, select: { runtime: true, timesRewatched: true } }),
      db.tvShow.findMany({ select: { episodesWatched: true, episodeRuntime: true, timesRewatched: true } }),
      db.game.aggregate({ _sum: { hoursPlayed: true } }),
      db.manga.findMany({ select: { chaptersRead: true, language: true, timesReread: true } }),
      db.article.findMany({ where: { status: "READ" }, select: { wordCount: true, language: true, timesReread: true } }),
    ]);

    const booksMinutes    = booksTime.reduce((s, b) => s + calculateReadingTime(b.pages, b.language as LanguageKey).minutes * (b.timesReread + 1), 0);
    const animeMinutes    = animeTime.reduce((s, a) => s + a.episodesWatched * a.episodeDuration * (a.timesRewatched + 1), 0);
    const moviesMinutes   = watchedMovies.reduce((s, m) => s + m.runtime * (m.timesRewatched + 1), 0);
    const tvMinutes       = tvTime.reduce((s, t) => s + t.episodesWatched * t.episodeRuntime * (t.timesRewatched + 1), 0);
    const gamesMinutes    = Math.round((gamesAgg._sum.hoursPlayed ?? 0) * 60);
    const mangaMinutes    = mangaTime.reduce((s, m) => s + calculateMangaTime(m.chaptersRead, m.language as LanguageKey).minutes * (m.timesReread + 1), 0);
    const comicsMinutes   = calculateComicTime(comicReadUnits, "ENGLISH").minutes;
    const articlesMinutes = articlesTime.reduce((s, a) => s + calculateArticleTime(a.wordCount, a.language as LanguageKey).minutes * (a.timesReread + 1), 0);

    const totalMinutes = booksMinutes + animeMinutes + moviesMinutes + tvMinutes + gamesMinutes + mangaMinutes + comicsMinutes + articlesMinutes;

    const sections = [
      {
        key: "books", href: "/library/books", label: "Books", minutes: booksMinutes,
        stats: [{ label: "Total", value: total(books) }, { label: "Read", value: c(books, "READ") }, { label: "Reading", value: c(books, "READING") }],
      },
      {
        key: "anime", href: "/library/anime", label: "Anime", minutes: animeMinutes,
        stats: [{ label: "Total", value: total(anime) }, { label: "Completed", value: c(anime, "COMPLETED") }, { label: "Watching", value: c(anime, "WATCHING") }],
      },
      {
        key: "movies", href: "/library/movies", label: "Movies", minutes: moviesMinutes,
        stats: [{ label: "Total", value: total(movies) }, { label: "Watched", value: c(movies, "WATCHED") }, { label: "Remaining", value: c(movies, "WANT_TO_WATCH") }],
      },
      {
        key: "tv", href: "/library/tv", label: "TV Shows", minutes: tvMinutes,
        stats: [{ label: "Total", value: total(tvShows) }, { label: "Completed", value: c(tvShows, "COMPLETED") }, { label: "Watching", value: c(tvShows, "WATCHING") }],
      },
      {
        key: "games", href: "/library/games", label: "Games", minutes: gamesMinutes,
        stats: [{ label: "Total", value: total(games) }, { label: "Completed", value: c(games, "COMPLETED") }, { label: "Playing", value: c(games, "PLAYING") }],
      },
      {
        key: "manga", href: "/library/manga", label: "Manga", minutes: mangaMinutes,
        stats: [{ label: "Total", value: total(manga) }, { label: "Completed", value: c(manga, "COMPLETED") }, { label: "Reading", value: c(manga, "READING") }],
      },
      {
        key: "comics", href: "/library/comics", label: "Comics", minutes: comicsMinutes,
        stats: [{ label: "Titles", value: comicTitleCount }, { label: "Issues", value: comicIssueCount }, { label: "Read", value: comicReadCount }],
      },
      {
        key: "articles", href: "/library/articles", label: "Articles", minutes: articlesMinutes,
        stats: [{ label: "Total", value: total(articles) }, { label: "Read", value: c(articles, "READ") }, { label: "Queued", value: c(articles, "WANT_TO_READ") }],
      },
    ];

    const [bookCovers, animeCovers, movieCovers, tvCovers, gameCovers, mangaCovers, comicCovers, articleCovers] = await Promise.all([
      db.book.findMany({ where: { coverImage: { not: null } }, select: { coverImage: true }, orderBy: { createdAt: "desc" } }),
      db.anime.findMany({ where: { coverImage: { not: null } }, select: { coverImage: true }, orderBy: { createdAt: "desc" } }),
      db.movie.findMany({ where: { coverImage: { not: null } }, select: { coverImage: true }, orderBy: { createdAt: "desc" } }),
      db.tvShow.findMany({ where: { coverImage: { not: null } }, select: { coverImage: true }, orderBy: { createdAt: "desc" } }),
      db.game.findMany({ where: { coverImage: { not: null } }, select: { coverImage: true }, orderBy: { createdAt: "desc" } }),
      db.manga.findMany({ where: { coverImage: { not: null } }, select: { coverImage: true }, orderBy: { createdAt: "desc" } }),
      // Title covers only, never issue covers — DashboardClient preloads every URL in this list
      // with new Image(), so a few hundred issues would fire a request storm on dashboard entry.
      db.comicTitle.findMany({ where: { coverImage: { not: null } }, select: { coverImage: true }, orderBy: { createdAt: "desc" } }),
      db.article.findMany({ where: { coverImage: { not: null } }, select: { coverImage: true }, orderBy: { createdAt: "desc" } }),
    ]);

    const coverImages = [
      ...bookCovers, ...animeCovers, ...movieCovers, ...tvCovers,
      ...gameCovers, ...mangaCovers, ...comicCovers, ...articleCovers,
    ].map(r => r.coverImage as string);

    return { sections, totalMinutes, coverImages };
  },
  ["library-dashboard-stats"],
  { tags: ["library-stats"], revalidate: 3600 }
);

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { sections, totalMinutes, coverImages } = await getDashboardData();
  return <DashboardClient sections={sections} totalMinutes={totalMinutes} coverImages={coverImages} />;
}
