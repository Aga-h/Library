import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function WardrobeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Wardrobe</h1>
      </header>
      <main className="p-8">{children}</main>
    </div>
  );
}
