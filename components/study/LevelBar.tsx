import { levelProgress } from "@/lib/leveling";
import { STAT_META, type Stat } from "@/lib/stats";

export default function LevelBar({ stat, xp }: { stat: Stat; xp: number }) {
  const meta = STAT_META[stat];
  const progress = levelProgress(xp);
  const Icon = meta.icon;

  return (
    <div className={`border ${meta.border} ${meta.bg} rounded-xl p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={`w-4 h-4 flex-shrink-0 ${meta.text}`} />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{meta.label}</p>
            <p className="text-[11px] text-gray-500 truncate">{meta.description}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-2xl font-bold leading-none ${meta.text}`}>{progress.level}</p>
          <p className="text-[10px] text-gray-400 font-semibold tracking-wide mt-0.5">LEVEL</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
          <div
            className={`h-full ${meta.bar} rounded-full transition-all`}
            style={{ width: `${Math.round(progress.ratio * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[11px] text-gray-500">
          <span>{progress.xp.toLocaleString()} XP</span>
          <span>{progress.remaining.toLocaleString()} to level {progress.level + 1}</span>
        </div>
      </div>
    </div>
  );
}
