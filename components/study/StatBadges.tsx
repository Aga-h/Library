import { STAT_META, type Stat } from "@/lib/stats";

/** The little STR / INT / WIS chips a module carries around. */
export default function StatBadges({
  stats,
  size = "sm",
}: {
  stats: Stat[];
  size?: "xs" | "sm";
}) {
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  return (
    <div className="flex flex-wrap items-center gap-1">
      {stats.map((stat) => {
        const meta = STAT_META[stat];
        return (
          <span
            key={stat}
            title={meta.label}
            className={`${pad} ${meta.bg} ${meta.text} ${meta.border} border rounded-md font-semibold tracking-wide`}
          >
            {meta.abbr}
          </span>
        );
      })}
    </div>
  );
}
