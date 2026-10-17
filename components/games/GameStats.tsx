import { Clock, Trophy } from "lucide-react";

interface Game { status: string; hoursPlayed: number; achievementsUnlocked: number; achievementsTotal: number | null; }

export default function GameStats({ games }: { games: Game[] }) {
  const playing   = games.filter((g) => g.status === "PLAYING");
  const completed = games.filter((g) => g.status === "COMPLETED");
  const platinum  = games.filter((g) => g.status === "PLATINUM");
  const planTo    = games.filter((g) => g.status === "PLAN_TO_PLAY");
  const dropped   = games.filter((g) => g.status === "DROPPED");
  const totalHours = games.reduce((s, g) => s + g.hoursPlayed, 0);
  const totalUnlocked = games.reduce((s, g) => s + g.achievementsUnlocked, 0);
  const totalAchievements = games.reduce((s, g) => s + (g.achievementsTotal ?? 0), 0);

  return (
    // Phones: after the results (the page is a flex column there). Above them, 350-410px of stats
    // filled the first screen, so a search or a filter showed no result without scrolling.
    <div className="max-sm:order-last mt-10 sm:mt-0 sm:mb-8 bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Game Stats</h2>
      {/* Phones: three across, then two across filling the row — not two, two and a lone one. */}
      <div className="grid grid-cols-6 sm:grid-cols-5 gap-2 sm:gap-3 mb-6">
        <StatPill label="Playing"     value={playing.length}   color="blue"   span="col-span-2" />
        <StatPill label="Completed"   value={completed.length} color="green"  span="col-span-2" />
        <StatPill label="Platinum"    value={platinum.length}  color="purple" span="col-span-2" />
        <StatPill label="Plan to Play" value={planTo.length}   color="yellow" span="col-span-3" />
        <StatPill label="Dropped"     value={dropped.length}   color="red"    span="col-span-3" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-gray-400"><Clock className="w-4 h-4" /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Hours Played</p>
            <p className="text-lg font-bold text-gray-800">{totalHours > 0 ? `${Math.round(totalHours * 10) / 10}h` : "—"}</p>
            {totalHours >= 24 && <p className="text-xs text-gray-400">{Math.round(totalHours / 24 * 10) / 10} days</p>}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-gray-400"><Trophy className="w-4 h-4" /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Achievements</p>
            <p className="text-lg font-bold text-gray-800">{totalUnlocked > 0 ? `${totalUnlocked}${totalAchievements > 0 ? `/${totalAchievements}` : ""}` : "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, color, span }: { label: string; value: number; color: "green"|"blue"|"yellow"|"red"|"purple"; span: string }) {
  const colors = { green: "bg-green-50 text-green-700 border-green-200", blue: "bg-blue-50 text-blue-700 border-blue-200", yellow: "bg-amber-50 text-amber-700 border-amber-200", red: "bg-red-50 text-red-700 border-red-200", purple: "bg-purple-50 text-purple-700 border-purple-200" };
  return (
    <div className={`${span} sm:col-span-1 min-w-0 flex flex-col items-center justify-center rounded-lg border p-2 sm:p-3 ${colors[color]}`}>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs font-medium mt-0.5 text-center max-w-full break-words">{label}</span>
    </div>
  );
}
