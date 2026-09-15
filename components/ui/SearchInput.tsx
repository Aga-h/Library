"use client";

import { useRef, useState, useEffect } from "react";
import { Search } from "lucide-react";

interface SearchInputProps {
  defaultValue: string;
  onSearch: (q: string) => void;
  placeholder?: string;
}

export default function SearchInput({ defaultValue, onSearch, placeholder = "Search..." }: SearchInputProps) {
  const [value, setValue] = useState(defaultValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Without this, a fast navigation leaves the pending debounce to fire after unmount.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(v), 300);
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        aria-label={placeholder ?? "Search"}
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 w-48"
      />
    </div>
  );
}
