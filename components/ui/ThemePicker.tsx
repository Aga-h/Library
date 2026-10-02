"use client";

import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { THEMES, type ThemeId } from "@/lib/themes";
import { applyTheme, currentTheme, subscribeTheme } from "@/lib/theme-client";

/**
 * Switches the site's look. Applied at once — the theme is a `data-theme` attribute the CSS keys
 * off — and remembered in a cookie for a year so the server renders it next time. Per device:
 * the iPad and the phone each keep their own.
 */
export default function ThemePicker({ variant = "full" }: { variant?: "full" | "compact" }) {
  // Read from the document, so every picker on the page agrees; nothing is marked during the
  // server render, which cannot know.
  const current: ThemeId | null = useSyncExternalStore(subscribeTheme, currentTheme, () => null);
  const choose = (id: ThemeId) => applyTheme(id);

  if (variant === "compact") {
    return (
      <div className="theme-picker px-3" role="radiogroup" aria-label="Look">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Look</p>
        <div className="flex flex-wrap gap-1.5">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={current === t.id} onClick={() => choose(t.id)}
              title={t.hint} aria-label={t.name}
              className={`theme-swatch relative w-7 h-7 rounded-md overflow-hidden border transition-transform hover:scale-105 ${
                current === t.id ? "border-gray-900 ring-2 ring-gray-900 ring-offset-1" : "border-gray-300"
              }`}>
              <Swatch colors={t.swatch} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="theme-picker grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" role="radiogroup" aria-label="Look">
      {THEMES.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={current === t.id} onClick={() => choose(t.id)}
          className={`theme-swatch-card text-left bg-white border rounded-xl p-3 transition-all hover:shadow-md ${
            current === t.id ? "border-gray-900 ring-2 ring-gray-900" : "border-gray-200"
          }`}>
          <div className="relative h-12 rounded-lg overflow-hidden border border-gray-200 mb-2">
            <Swatch colors={t.swatch} />
          </div>
          <p className="flex items-center justify-between text-sm font-semibold text-gray-900">
            {t.name}
            {current === t.id && <Check className="w-4 h-4" />}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{t.hint.split(" — ")[1] ?? t.hint}</p>
        </button>
      ))}
    </div>
  );
}

/** Four bands of the theme's own colours — drawn with fixed values, so every theme previews true
 *  whatever theme is showing. */
function Swatch({ colors }: { colors: readonly string[] }) {
  return (
    <span aria-hidden className="absolute inset-0 flex">
      {colors.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
    </span>
  );
}
