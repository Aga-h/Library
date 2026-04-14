export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  BookOpen,
  Film,
  Tv2,
  Gamepad2,
  BookMarked,
  Layers,
  Newspaper,
  ArrowRight,
} from "lucide-react";
import { db } from "@/lib/db";

export default async function HomePage() {
  const [totalBooks, readBooks, readingBooks] = await Promise.all([
    db.book.count(),
    db.book.count({ where: { status: "READ" } }),
    db.book.count({ where: { status: "READING" } }),
  ]);

  const MEDIA_SECTIONS = [
    {
      href: "/books",
      label: "Books",
      icon: BookOpen,
      active: true,
      stats: [
        { label: "Total", value: totalBooks },
        { label: "Read", value: readBooks },
        { label: "Reading", value: readingBooks },
      ],
      color: "from-blue-50 to-indigo-50 border-blue-200",
      iconColor: "text-blue-600",
    },
    { href: "/anime",   label: "Anime",    icon: Layers,     active: false, color: "from-pink-50 to-rose-50 border-pink-200",   iconColor: "text-pink-500" },
    { href: "/movies",  label: "Movies",   icon: Film,       active: false, color: "from-purple-50 to-violet-50 border-purple-200", iconColor: "text-purple-500" },
    { href: "/tv",      label: "TV Shows", icon: Tv2,        active: false, color: "from-orange-50 to-amber-50 border-orange-200",  iconColor: "text-orange-500" },
    { href: "/games",   label: "Games",    icon: Gamepad2,   active: false, color: "from-green-50 to-emerald-50 border-green-200",  iconColor: "text-green-500" },
    { href: "/manga",   label: "Manga",    icon: BookMarked, active: false, color: "from-cyan-50 to-sky-50 border-cyan-200",     iconColor: "text-cyan-500" },
    { href: "/comics",  label: "Comics",   icon: BookMarked, active: false, color: "from-yellow-50 to-lime-50 border-yellow-200",   iconColor: "text-yellow-500" },
    { href: "/articles",label: "Articles", icon: Newspaper,  active: false, color: "from-gray-50 to-slate-50 border-gray-200",    iconColor: "text-gray-500" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Your personal media library</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {MEDIA_SECTIONS.map((section) => {
          const Icon = section.icon;

          if (!section.active) {
            return (
              <div
                key={section.href}
                className={`relative bg-gradient-to-br ${section.color} border rounded-xl p-5 opacity-60`}
              >
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`w-5 h-5 ${section.iconColor}`} />
                  <span className="text-xs font-semibold text-gray-400 bg-white/80 px-2 py-0.5 rounded-full">
                    Coming Soon
                  </span>
                </div>
                <p className="font-semibold text-gray-700">{section.label}</p>
              </div>
            );
          }

          return (
            <Link
              key={section.href}
              href={section.href}
              className={`group relative bg-gradient-to-br ${section.color} border rounded-xl p-5 hover:shadow-md transition-all`}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className={`w-5 h-5 ${section.iconColor}`} />
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="font-semibold text-gray-800 mb-3">{section.label}</p>
              {"stats" in section && section.stats && (
                <div className="flex gap-4">
                  {section.stats.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
