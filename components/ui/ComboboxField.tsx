"use client";

import { useId, useState } from "react";
import { inputCls } from "@/components/ui/form";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}


export default function ComboboxField({ label, value, onChange, options, placeholder, required }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const q = value.toLowerCase();
  const filtered = options.filter(o => o.toLowerCase().includes(q));

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="text"
          required={required}
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 100)}
          placeholder={placeholder}
          autoComplete="off"
          className={inputCls}
        />
        {/* As wide as the field, so it fits any screen the field does; options are a little
            taller on phones, and a long one wraps. */}
        {open && filtered.length > 0 && (
          <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
            {filtered.map(opt => (
              <li key={opt}>
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); onChange(opt); setOpen(false); }}
                  className="w-full text-left px-3 py-2.5 sm:py-2 text-sm text-gray-700 break-words hover:bg-gray-50 transition-colors"
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
