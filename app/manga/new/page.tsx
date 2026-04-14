import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import MangaForm from "@/components/manga/MangaForm";

export default function NewMangaPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/manga" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Manga
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Add Manga</h1>
        <MangaForm mode="create" />
      </div>
    </div>
  );
}
