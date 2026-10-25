"use client";

import { TASK_COLORS, TASK_COLOR_CLASS, TASK_COLOR_LABEL, type TaskColor } from "@/lib/study-tasks";

export default function ColorSwatches({
  value, onChange, label,
}: {
  value: TaskColor;
  onChange: (color: TaskColor) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {TASK_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={TASK_COLOR_LABEL[color]}
          onClick={() => onChange(color)}
          className={`w-6 h-6 max-sm:w-9 max-sm:h-9 rounded-full ${TASK_COLOR_CLASS[color].swatch} ${
            value === color ? "ring-2 ring-offset-2 ring-gray-900" : ""
          }`}
        />
      ))}
    </div>
  );
}
