import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import MalListImport from "@/components/anime/MalListImport";

export default function ImportAnimeListPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/library/anime/new" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Add Anime
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Import your MyAnimeList list</h1>
        <p className="text-sm text-gray-500 mb-6">
          Every completed season comes in as watched, with episodes, episode length, studio and
          poster — seasons of the same show together as a series. Films, OVAs, specials, recaps and
          web shorts are left out; you can tick any of them back in before importing.
        </p>
        <MalListImport />
      </div>
    </div>
  );
}
