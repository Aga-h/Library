export const dynamic = "force-dynamic";

import { deck } from "@/lib/flashcard-service";
import { listModules, openSession, toRunningView } from "@/lib/study-service";
import Flashcards from "@/components/study/Flashcards";
import SatVocabQuickStart from "@/components/study/SatVocabQuickStart";

export default async function FlashcardsPage() {
  const now = new Date();
  const [initial, modules, running] = await Promise.all([deck(), listModules(), openSession()]);
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Flashcards</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Every SAT word is a card, scheduled the way Anki does it: the better you know a word, the
          longer until you see it again. Answer honestly — Again brings it back in minutes.
        </p>
      </div>
      <SatVocabQuickStart
        modules={modules.map((m) => ({ id: m.id, title: m.title, stats: m.stats }))}
        running={running ? { ...toRunningView(running), moduleId: running.moduleId } : null}
        serverNow={now.getTime()}
      />
      <Flashcards initial={initial} />
    </div>
  );
}
