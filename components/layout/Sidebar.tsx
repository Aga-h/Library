"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Film,
  Tv2,
  Gamepad2,
  BookMarked,
  Layers,
  Newspaper,
  Library,
} from "lucide-react";

const NAV_ITEMS = [
  {
    href: "/books",
    label: "Books",
    icon: BookOpen,
    active: true,
  },
  {
    href: "/anime",
    label: "Anime",
    icon: Layers,
    active: false,
  },
  {
    href: "/movies",
    label: "Movies",
    icon: Film,
    active: false,
  },
  {
    href: "/tv",
    label: "TV Shows",
    icon: Tv2,
    active: false,
  },
  {
    href: "/games",
    label: "Games",
    icon: Gamepad2,
    active: false,
  },
  {
    href: "/manga",
    label: "Manga",
    icon: BookMarked,
    active: false,
  },
  {
    href: "/comics",
    label: "Comics",
    icon: BookMarked,
    active: false,
  },
  {
    href: "/articles",
    label: "Articles",
    icon: Newspaper,
    active: false,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-white border-r border-gray-200 min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-200">
        <Library className="w-6 h-6 text-gray-900" />
        <span className="font-bold text-gray-900 text-lg">MyLibrary</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          const isAvailable = item.active;

          return (
            <div key={item.href}>
              {isAvailable ? (
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 cursor-not-allowed">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                  <span className="ml-auto text-[10px] font-semibold text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">Personal Media Library</p>
      </div>
    </aside>
  );
}
