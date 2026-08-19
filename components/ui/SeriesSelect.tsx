"use client";

import { Field, inputCls } from "@/components/ui/form";

export interface SeriesOption {
  id: string;
  name: string;
  universeName: string | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SeriesOption[];
  label?: string;
  emptyLabel?: string;
}

/**
 * Picks the series an entry belongs to. An empty value means standalone — the entry
 * shows on the section's main page instead of inside a series.
 */
export default function SeriesSelect({
  value,
  onChange,
  options,
  label = "Series",
  emptyLabel = "None — show on the main page",
}: Props) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.universeName ? `${o.universeName} · ${o.name}` : o.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
