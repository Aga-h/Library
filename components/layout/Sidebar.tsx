"use client";

import {
  BookOpen, Film, Tv2, Gamepad2, BookMarked, Layers, Newspaper, Library, LayoutDashboard,
} from "lucide-react";
import SectionNav, { type NavItem } from "@/components/layout/SectionNav";

const NAV_ITEMS: NavItem[] = [
  { href: "/library",          label: "Dashboard", icon: LayoutDashboard, exact: true },
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
  return <SectionNav brand="MyLibrary" icon={Library} groups={[{ items: NAV_ITEMS }]} signOut />;
}
