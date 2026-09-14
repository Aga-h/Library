"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CalendarDays, Layers, ListTodo, Swords, TrendingUp } from "lucide-react";

const NAV_ITEMS = [
  { href: "/tasks",           label: "Today",    icon: ListTodo },
  { href: "/tasks/calendar",  label: "Calendar", icon: CalendarDays },
  { href: "/tasks/stats",     label: "Stats",    icon: TrendingUp },
  { href: "/tasks/modules",   label: "Modules",  icon: Layers },
];

export default function TasksSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-white border-r border-gray-200 min-h-screen">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-200">
        <Swords className="w-6 h-6 text-gray-900" />
        <span className="font-bold text-gray-900 text-lg">Tasks</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/tasks" ? pathname === "/tasks" : pathname.startsWith(item.href);
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
      <div className="px-3 py-4 border-t border-gray-100">
        <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4 flex-shrink-0" />
          Back to Portal
        </Link>
      </div>
    </aside>
  );
}
