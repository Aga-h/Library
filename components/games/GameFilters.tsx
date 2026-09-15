"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PLATFORM_GROUPS, PLATFORM_LABELS } from "@/lib/constants/platforms";
import SearchInput from "@/components/ui/SearchInput";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "PLAYING", label: "Playing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PLATINUM", label: "Platinum" },
  { value: "PLAN_TO_PLAY", label: "Plan to Play" },
  { value: "DROPPED", label: "Dropped" },
];

export default function GameFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "";
  const currentPlatform = searchParams.get("platform") ?? "";
  const currentQ = searchParams.get("q") ?? "";

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.push(`/library/games?${params.toString()}`);
  }

  function setSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value); else params.delete("q");
    router.replace(`/library/games?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg flex-wrap">
        {STATUS_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => setFilter("status", opt.value)}
            className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${currentStatus === opt.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {opt.label}
          </button>
        ))}
      </div>
      <select value={currentPlatform} onChange={(e) => setFilter("platform", e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300">
        <option value="">All Platforms</option>
        {PLATFORM_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
          </optgroup>
        ))}
      </select>
      <SearchInput defaultValue={currentQ} onSearch={setSearch} placeholder="Search title or developer…" />
    </div>
  );
}
