"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "READING", label: "Reading" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PLAN_TO_READ", label: "Plan to Read" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "DROPPED", label: "Dropped" },
];

export default function MangaFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "";
  const currentLang = searchParams.get("language") ?? "";

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.push(`/library/manga?${params.toString()}`);
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
      <select value={currentLang} onChange={(e) => setFilter("language", e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300">
        <option value="">All Languages</option>
        {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>
    </div>
  );
}
