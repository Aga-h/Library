import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="px-8 py-4 border-b border-gray-200 bg-white flex items-center gap-4">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Portal
        </Link>
        <span className="text-gray-300">/</span>
        <Link href="/calendar" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          Calendar
        </Link>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
