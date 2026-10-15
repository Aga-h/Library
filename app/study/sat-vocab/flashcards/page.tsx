export const dynamic = "force-dynamic";

import { deck } from "@/lib/flashcard-service";
import Flashcards from "@/components/study/Flashcards";

export default async function FlashcardsPage() {
  const initial = await deck();
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Flashcards</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Every SAT word is a card, scheduled the way Anki does it: the better you know a word, the
          longer until you see it again. Answer honestly — Again brings it back in minutes.
        </p>
      </div>
      <Flashcards initial={initial} />
    </div>
  );
}
