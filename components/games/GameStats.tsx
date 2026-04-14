"use client";

import { Gamepad2, Clock, Trophy } from "lucide-react";

interface Game { status: string; hoursPlayed: number; }

export default function GameStats({ games }: { games: Game[] }) {
  const playing   = games.filter((g) => g.status === "PLAYING");
  const completed = games.filter((g) => g.status === "COMPLETED");
  const platinum  = games.filter((g) => g.status === "PLATINUM");
  const planTo    = games.filter((g) => g.status === "PLAN_TO_PLAY");
  const dropped   = games.filter((g) => g.status === "DROPPED");
  const totalHours = games.reduce((s, g) => s + g.hoursPlayed, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Game Stats</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <StatPill label="Playing"     value={playing.length}   color="blue"   />
        <StatPill label="Completed"   value={completed.length} color="green"  />
        <StatPill label="Platinum"    value={platinum.length}  color="purple" />
        <StatPill label="Plan to Play" value={planTo.length}   color="yellow" />
        <StatPill label="Dropped"     value={dropped.length}   color="red"    />
      </div>
      <div className="pt-4 border-t border-gray-100 flex items-start gap-3">
        <div className="mt-0.5 text-gray-400"><Clock className="w-4 h-4" /></div>
        <div>
          <p className="text-xs text-gray-500 font-medium">Total Hours Played</p>
          <p className="text-lg font-bold text-gray-800">{totalHours > 0 ? `${Math.round(totalHours * 10) / 10}h` : "—"}</p>
          {totalHours >= 24 && <p className="text-xs text-gray-400">{Math.round(totalHours / 24 * 10) / 10} days</p>}
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: "green"|"blue"|"yellow"|"red"|"purple" }) {
  const colors = { green: "bg-green-50 text-green-700 border-green-200", blue: "bg-blue-50 text-blue-700 border-blue-200", yellow: "bg-amber-50 text-amber-700 border-amber-200", red: "bg-red-50 text-red-700 border-red-200", purple: "bg-purple-50 text-purple-700 border-purple-200" };
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border p-3 ${colors[color]}`}>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs font-medium mt-0.5 text-center">{label}</span>
    </div>
  );
}
