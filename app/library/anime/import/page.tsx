import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import MalListImport from "@/components/anime/MalListImport";

export default function ImportAnimeListPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/library/anime" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Anime
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Import a MyAnimeList list</h1>
        <p className="text-sm text-gray-500 mb-6">
          Everything on your list that is a complete season — a TV or web series you finished — is
          logged as watched, grouped into series by MyAnimeList&apos;s sequel links. Films, OVAs,
          specials, recaps and shorts are left out, and listed so you can see why. Running it again
          only adds what&apos;s new.
        </p>
        <MalListImport />
      </div>
    </div>
  );
}
