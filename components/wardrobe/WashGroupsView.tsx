import Link from "next/link";

const TEMP_MAP: Record<string, number> = { COLD: 20, W30: 30, W40: 40, W60: 60, W90: 90 };
const SPIN_RANK: Record<string, number> = { NONE: 0, REDUCED: 1, NORMAL: 2 };
const SPIN_LABEL: Record<string, string> = { NONE: "No spin", REDUCED: "Reduced spin", NORMAL: "Normal spin" };

const COLOR_LABELS: Record<string, string> = {
  WHITE: "White", LIGHT: "Light colours", DARK: "Dark colours", VIVID: "Vivid colours", MIXED: "Mixed / unsorted",
};
const METHOD_LABELS: Record<string, string> = {
  MACHINE: "Machine wash", HAND: "Hand wash", DRY_CLEAN: "Dry clean",
};
const CYCLE_LABELS: Record<string, string> = { NORMAL: "Normal cycle", GENTLE: "Gentle cycle" };

const COLOR_SWATCH: Record<string, string> = {
  WHITE: "bg-white border-2 border-gray-300",
  LIGHT: "bg-gray-200",
  DARK: "bg-gray-700",
  VIVID: "bg-gradient-to-br from-pink-400 via-yellow-400 to-blue-400",
  MIXED: "bg-gradient-to-r from-gray-700 via-gray-300 to-white",
};

const TYPE_LABELS: Record<string, string> = {
  TOPS: "Top", BOTTOMS: "Bottoms", OUTERWEAR: "Outerwear",
  UNDERWEAR: "Underwear", SOCKS: "Socks", ACTIVEWEAR: "Activewear",
  FORMALWEAR: "Formalwear", ACCESSORIES: "Accessories", OTHER: "Other",
};

interface Garment {
  id: string; name: string; type: string; brand: string | null;
  colorGroup: string; washMethod: string; maxTemp: string;
  washCycle: string; spinLevel: string; wornCount: number;
}

interface WashGroup {
  key: string;
  colorGroup: string;
  washMethod: string;
  washCycle: string;
  safeTemp: number;
  safeSpin: string;
  items: Garment[];
  needsWashCount: number;
}

function groupGarments(garments: Garment[]): WashGroup[] {
  const map = new Map<string, WashGroup>();

  for (const g of garments) {
    if (g.washMethod === "DO_NOT_WASH") continue;
    const key = `${g.colorGroup}__${g.washMethod}__${g.washCycle}`;
    const existing = map.get(key);
    const temp = TEMP_MAP[g.maxTemp] ?? 40;
    const needsWash = g.wornCount > 0 ? 1 : 0;

    if (!existing) {
      map.set(key, {
        key, colorGroup: g.colorGroup, washMethod: g.washMethod,
        washCycle: g.washCycle, safeTemp: temp, safeSpin: g.spinLevel,
        items: [g], needsWashCount: needsWash,
      });
    } else {
      existing.items.push(g);
      existing.safeTemp = Math.min(existing.safeTemp, temp);
      existing.needsWashCount += needsWash;
      // Use lowest spin
      if (SPIN_RANK[g.spinLevel] < SPIN_RANK[existing.safeSpin]) {
        existing.safeSpin = g.spinLevel;
      }
    }
  }

  // Sort: groups with most urgent items first
  return Array.from(map.values()).sort((a, b) => b.needsWashCount - a.needsWashCount);
}

function urgencyBadge(type: string, wornCount: number) {
  const base = type === "UNDERWEAR" || type === "SOCKS";
  if (wornCount === 0) return { label: "Clean", cls: "bg-green-50 text-green-700 border-green-200" };
  if (base || wornCount >= 5) return { label: "Wash now", cls: "bg-red-50 text-red-700 border-red-200" };
  if (wornCount >= 3) return { label: `${wornCount} wears`, cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: `${wornCount} wear${wornCount > 1 ? "s" : ""}`, cls: "bg-gray-50 text-gray-500 border-gray-200" };
}

export default function WashGroupsView({ garments }: { garments: Garment[] }) {
  const groups = groupGarments(garments);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-12 text-center">
        No washable garments yet — add some items first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Group header */}
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`w-4 h-4 rounded-full flex-shrink-0 inline-block ${COLOR_SWATCH[group.colorGroup]}`} />
              <span className="font-semibold text-gray-800 text-sm">{COLOR_LABELS[group.colorGroup]}</span>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-600">{METHOD_LABELS[group.washMethod]}</span>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-600">{CYCLE_LABELS[group.washCycle]}</span>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-600">{group.safeTemp}°C max</span>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-600">{SPIN_LABEL[group.safeSpin]}</span>
            </div>
            <div className="flex-shrink-0">
              {group.needsWashCount > 0 ? (
                <span className="text-xs font-semibold bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">
                  {group.needsWashCount} of {group.items.length} need washing
                </span>
              ) : (
                <span className="text-xs font-semibold bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full">
                  All clean
                </span>
              )}
            </div>
          </div>

          {/* Item list */}
          <ul className="divide-y divide-gray-50">
            {group.items
              .sort((a, b) => b.wornCount - a.wornCount)
              .map((item) => {
                const badge = urgencyBadge(item.type, item.wornCount);
                return (
                  <li key={item.id}>
                    <Link
                      href={`/wardrobe/${item.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-800">{item.name}</span>
                        {item.brand && <span className="text-xs text-gray-400 ml-1.5">· {item.brand}</span>}
                        <span className="text-xs text-gray-400 ml-1.5">
                          · {TYPE_LABELS[item.type] ?? item.type}
                        </span>
                      </div>
                      <span className={`text-xs font-semibold border px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}
