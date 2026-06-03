"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import SearchInput from "@/components/ui/SearchInput";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "READ", label: "Read" },
  { value: "READING", label: "Reading" },
  { value: "WANT_TO_READ", label: "Plan to Read" },
  { value: "DNF", label: "Dropped" },
];

export default function BookFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "";
  const currentLang = searchParams.get("language") ?? "";
  const currentQ = searchParams.get("q") ?? "";

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/library/books?${params.toString()}`);
  }

  function setSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value); else params.delete("q");
    router.replace(`/library/books?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      {/* Status tabs */}
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

      {/* Language filter */}
      <select
        value={currentLang}
        onChange={(e) => setFilter("language", e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
      >
        <option value="">All Languages</option>
        {LANGUAGE_OPTIONS.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>

      <SearchInput defaultValue={currentQ} onSearch={setSearch} placeholder="Search title or author…" />
    </div>
  );
}
