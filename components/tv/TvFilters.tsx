"use client";

import { useRouter, useSearchParams } from "next/navigation";
import SearchInput from "@/components/ui/SearchInput";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "WATCHING", label: "Watching" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PLAN_TO_WATCH", label: "Plan to Watch" },
];

export default function TvFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "";
  const currentQ = searchParams.get("q") ?? "";

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/library/tv?${params.toString()}`);
  }

  function setSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value); else params.delete("q");
    router.replace(`/library/tv?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg flex-wrap">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter("status", opt.value)}
            className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
              currentStatus === opt.value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <SearchInput defaultValue={currentQ} onSearch={setSearch} placeholder="Search title or creator…" />
    </div>
  );
}
