"use client";

import { Field, inputCls } from "@/components/ui/form";

export interface HierarchyOption {
  id: string;
  name: string;
  /** Name of the level above, shown as a prefix to disambiguate repeated names. */
  parentName: string | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: HierarchyOption[];
  label?: string;
  emptyLabel?: string;
}

/**
 * Picks the parent an entry belongs to — a series for books, TV and anime, a universe
 * for movies. An empty value means standalone: the entry shows on the section's main
 * page instead of inside its parent.
 */
export default function HierarchySelect({
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
            {o.parentName ? `${o.parentName} · ${o.name}` : o.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
