export const dynamic = "force-dynamic";

import Link from "next/link";
import { BookMarked, Shirt, ArrowRight } from "lucide-react";

const SECTIONS = [
  {
    href: "/library",
    label: "Library",
    description: "Books, anime, manga, games, movies & more",
    icon: BookMarked,
    color: "from-blue-50 to-indigo-50 border-blue-200",
    iconColor: "text-blue-600",
    available: true,
  },
  {
    href: "/wardrobe",
    label: "Wardrobe",
    description: "Smart washing & drying calculator",
    icon: Shirt,
    color: "from-emerald-50 to-teal-50 border-emerald-200",
    iconColor: "text-emerald-600",
    available: true,
  },
  {
    href: "#",
    label: "Coming Soon",
    description: "More sections are on the way",
    icon: ArrowRight,
    color: "from-gray-50 to-gray-100 border-gray-200",
    iconColor: "text-gray-300",
    available: false,
  },
];

export default function PortalPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="px-8 py-6 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-bold text-gray-900">My Portal</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your personal hub</p>
      </header>

      <main className="flex-1 p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return section.available ? (
              <Link key={section.href} href={section.href}
                className={`group bg-gradient-to-br ${section.color} border rounded-xl p-6 hover:shadow-md transition-all`}>
                <div className="flex items-center justify-between mb-4">
                  <Icon className={`w-6 h-6 ${section.iconColor}`} />
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="font-semibold text-gray-900 mb-1">{section.label}</p>
                <p className="text-sm text-gray-500">{section.description}</p>
              </Link>
            ) : (
              <div key={section.label}
                className={`bg-gradient-to-br ${section.color} border rounded-xl p-6 opacity-60`}>
                <div className="flex items-center justify-between mb-4">
                  <Icon className={`w-6 h-6 ${section.iconColor}`} />
                </div>
                <p className="font-semibold text-gray-400 mb-1">{section.label}</p>
                <p className="text-sm text-gray-400">{section.description}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
