"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen, Film, Tv2, Gamepad2, BookMarked, Layers, Newspaper,
  ArrowRight, Clock, LayoutGrid, PieChart,
} from "lucide-react";
import { formatReadingTime } from "@/lib/reading-time";

export interface SectionData {
  key: string;
  href: string;
  label: string;
  minutes: number;
  stats: { label: string; value: number }[];
}

const META: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  iconColor: string;
  chartColor: string;
}> = {
  books:    { icon: BookOpen,   color: "from-blue-50 to-indigo-50 border-blue-200",     iconColor: "text-blue-600",   chartColor: "#3b82f6" },
  anime:    { icon: Layers,     color: "from-pink-50 to-rose-50 border-pink-200",       iconColor: "text-pink-500",   chartColor: "#ec4899" },
  movies:   { icon: Film,       color: "from-purple-50 to-violet-50 border-purple-200", iconColor: "text-purple-500", chartColor: "#a855f7" },
  tv:       { icon: Tv2,        color: "from-orange-50 to-amber-50 border-orange-200",  iconColor: "text-orange-500", chartColor: "#f97316" },
  games:    { icon: Gamepad2,   color: "from-green-50 to-emerald-50 border-green-200",  iconColor: "text-green-500",  chartColor: "#22c55e" },
  manga:    { icon: BookMarked, color: "from-cyan-50 to-sky-50 border-cyan-200",        iconColor: "text-cyan-500",   chartColor: "#06b6d4" },
  comics:   { icon: BookMarked, color: "from-yellow-50 to-lime-50 border-yellow-200",   iconColor: "text-yellow-600", chartColor: "#eab308" },
  articles: { icon: Newspaper,  color: "from-gray-50 to-slate-50 border-gray-200",     iconColor: "text-gray-500",   chartColor: "#6b7280" },
};

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number) {
  const gap = 1.5;
  const s = startDeg + gap / 2;
  const e = endDeg - gap / 2;
  if (e - s < 0.5) return "";
  const o1 = polarToCartesian(cx, cy, outerR, s);
  const o2 = polarToCartesian(cx, cy, outerR, e);
  const i1 = polarToCartesian(cx, cy, innerR, s);
  const i2 = polarToCartesian(cx, cy, innerR, e);
  const large = e - s > 180 ? 1 : 0;
  return `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)} A ${outerR} ${outerR} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)} L ${i2.x.toFixed(2)} ${i2.y.toFixed(2)} A ${innerR} ${innerR} 0 ${large} 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)} Z`;
}

export default function DashboardClient({ sections, totalMinutes, coverImages }: { sections: SectionData[]; totalMinutes: number; coverImages: string[] }) {
  const [view, setView] = useState<"grid" | "chart">("grid");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    for (const url of coverImages) {
      const img = new Image();
      img.src = url;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Your personal media library</p>
        </div>
        <div className="flex items-center gap-3">
          {totalMinutes > 0 && (
            <div className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl">
              <Clock className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400 leading-none mb-0.5">Total time consumed</p>
                <p className="text-sm font-bold leading-none">{formatReadingTime(totalMinutes)}</p>
              </div>
            </div>
          )}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
            <button
              onClick={() => setView("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                view === "grid" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Grid
            </button>
            <button
              onClick={() => setView("chart")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                view === "chart" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <PieChart className="w-4 h-4" />
              Chart
            </button>
          </div>
        </div>
      </div>

      {view === "grid" ? (
        <GridView sections={sections} />
      ) : (
        <ChartView
          sections={sections}
          totalMinutes={totalMinutes}
          hoveredKey={hoveredKey}
          setHoveredKey={setHoveredKey}
          onNavigate={(href) => router.push(href)}
        />
      )}
    </div>
  );
}

function GridView({ sections }: { sections: SectionData[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {sections.map((section) => {
        const meta = META[section.key];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <Link
            key={section.href}
            href={section.href}
            className={`group relative bg-gradient-to-br ${meta.color} border rounded-xl p-5 hover:shadow-md transition-all`}
          >
            <div className="flex items-center justify-between mb-3">
              <Icon className={`w-5 h-5 ${meta.iconColor}`} />
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="font-semibold text-gray-800 mb-3">{section.label}</p>
            <div className="flex gap-4">
              {section.stats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function ChartView({
  sections, totalMinutes, hoveredKey, setHoveredKey, onNavigate,
}: {
  sections: SectionData[];
  totalMinutes: number;
  hoveredKey: string | null;
  setHoveredKey: (key: string | null) => void;
  onNavigate: (href: string) => void;
}) {
  const slices = sections.filter((s) => s.minutes > 0);
  const chartTotal = slices.reduce((s, c) => s + c.minutes, 0);

  if (slices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-gray-400 text-lg font-medium">No time data yet</p>
        <p className="text-gray-400 text-sm mt-1">Start logging media to see your breakdown.</p>
      </div>
    );
  }

  const cx = 160, cy = 160, outerR = 130, innerR = 74;
  let angle = 0;
  const paths: { key: string; href: string; d: string; color: string }[] = [];

  for (const section of slices) {
    const meta = META[section.key];
    if (!meta) continue;
    const sweep = (section.minutes / chartTotal) * 360;
    const d = slicePath(cx, cy, outerR, innerR, angle, angle + sweep);
    if (d) paths.push({ key: section.key, href: section.href, d, color: meta.chartColor });
    angle += sweep;
  }

  const hovered = hoveredKey ? slices.find((s) => s.key === hoveredKey) : null;

  return (
    <div className="flex flex-col lg:flex-row gap-10 items-center lg:items-start">
      {/* Donut */}
      <div className="flex-shrink-0">
        <svg width="320" height="320" viewBox="0 0 320 320">
          {paths.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill={p.color}
              style={{
                opacity: hoveredKey && hoveredKey !== p.key ? 0.35 : 1,
                transform: hoveredKey === p.key ? `scale(1.04)` : "scale(1)",
                transformOrigin: `${cx}px ${cy}px`,
                transition: "transform 150ms ease, opacity 150ms ease",
                cursor: "pointer",
              }}
              onClick={() => onNavigate(p.href)}
              onMouseEnter={() => setHoveredKey(p.key)}
              onMouseLeave={() => setHoveredKey(null)}
            />
          ))}
          {/* Center label */}
          <text x={cx} y={cy - 14} textAnchor="middle" fill="#6b7280" fontSize="12" fontWeight="500">
            {hovered ? hovered.label : "Total time"}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="#111827" fontSize="22" fontWeight="700">
            {formatReadingTime(hovered ? hovered.minutes : chartTotal)}
          </text>
          {hovered && (
            <text x={cx} y={cy + 30} textAnchor="middle" fill="#9ca3af" fontSize="13">
              {Math.round((hovered.minutes / chartTotal) * 100)}%
            </text>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
        {slices.map((section) => {
          const meta = META[section.key];
          if (!meta) return null;
          const pct = Math.round((section.minutes / chartTotal) * 100);
          const isHovered = hoveredKey === section.key;
          return (
            <button
              key={section.key}
              onClick={() => onNavigate(section.href)}
              onMouseEnter={() => setHoveredKey(section.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={`flex items-center gap-3 p-3 rounded-xl text-left w-full transition-all border ${
                isHovered ? "bg-gray-50 border-gray-200 shadow-sm" : "border-transparent hover:bg-gray-50 hover:border-gray-100"
              }`}
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: meta.chartColor }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{section.label}</p>
                <p className="text-xs text-gray-500">{formatReadingTime(section.minutes)}</p>
              </div>
              <span className="text-xs font-medium text-gray-400 tabular-nums">{pct}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
