"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen, Film, Tv2, Gamepad2, BookMarked, Layers, Newspaper, Library, LayoutDashboard,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/library",          label: "Dashboard", icon: LayoutDashboard },
  { href: "/library/books",    label: "Books",     icon: BookOpen    },
  { href: "/library/anime",    label: "Anime",     icon: Layers      },
  { href: "/library/movies",   label: "Movies",    icon: Film        },
  { href: "/library/tv",       label: "TV Shows",  icon: Tv2         },
  { href: "/library/games",    label: "Games",     icon: Gamepad2    },
  { href: "/library/manga",    label: "Manga",     icon: BookMarked  },
  { href: "/library/comics",   label: "Comics",    icon: BookMarked  },
  { href: "/library/articles", label: "Articles",  icon: Newspaper   },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-white border-r border-gray-200 min-h-screen">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-200">
        <Library className="w-6 h-6 text-gray-900" />
        <span className="font-bold text-gray-900 text-lg">MyLibrary</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/library"
            ? pathname === "/library"
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">Personal Media Library</p>
      </div>
    </aside>
  );
}
