"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BookA, GraduationCap, Layers, ListChecks, Timer, TrendingUp } from "lucide-react";

const SESSION_ITEMS = [
  { href: "/study", label: "Study", icon: Timer, exact: true },
  { href: "/study/modules", label: "Modules", icon: Layers },
  { href: "/study/stats", label: "Stats", icon: TrendingUp },
  { href: "/study/ap", label: "APs", icon: GraduationCap },
];

const VOCAB_ITEMS = [
  { href: "/study/sat-vocab", label: "SAT Vocabulary", icon: BookA, exact: true },
  { href: "/study/sat-vocab/words", label: "Word list", icon: ListChecks },
];

export default function StudySidebar() {
  const pathname = usePathname();

  const link = (item: { href: string; label: string; icon: typeof Timer; exact?: boolean }) => {
    const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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
  };

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-white border-r border-gray-200 min-h-screen">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-200">
        <GraduationCap className="w-6 h-6 text-gray-900" />
        <span className="font-bold text-gray-900 text-lg">Study</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {SESSION_ITEMS.map(link)}
        <p className="text-[11px] font-bold text-gray-300 uppercase tracking-wide px-3 pt-4 pb-1">
          Vocabulary
        </p>
        {VOCAB_ITEMS.map(link)}
      </nav>
      <div className="px-3 py-4 border-t border-gray-100">
        <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4 flex-shrink-0" />
          Back to Portal
        </Link>
      </div>
    </aside>
  );
}
