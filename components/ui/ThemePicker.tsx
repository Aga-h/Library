"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown } from "lucide-react";
import { THEMES, type ThemeId } from "@/lib/themes";
import { applyTheme, currentTheme, subscribeTheme } from "@/lib/theme-client";

/**
 * Switches the site's look. Applied at once — the theme is a `data-theme` attribute the CSS keys
 * off — and remembered in a cookie for a year so the server renders it next time. Per device:
 * the iPad and the phone each keep their own.
 *
 * Folded away until opened: the other looks' colours would clash with whichever one is showing.
 * `full` opens in place (the portal); `compact` opens upwards over the sidebar's foot.
 */
export default function ThemePicker({ variant = "full" }: { variant?: "full" | "compact" }) {
  // Read from the document, so every picker on the page agrees; nothing is marked during the
  // server render, which cannot know.
  const current: ThemeId | null = useSyncExternalStore(subscribeTheme, currentTheme, () => null);
  const currentName = THEMES.find((t) => t.id === current)?.name;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Close on a click elsewhere, or on Escape (handing focus back to the toggle).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (id: ThemeId) => {
    applyTheme(id);
    if (variant === "compact") setOpen(false);
  };

  if (variant === "compact") {
    return (
      <div ref={root} className="theme-picker relative px-3">
        <button ref={toggle} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}
          className="theme-picker-toggle w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
          <span>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mr-2">Look</span>
            {currentName}
          </span>
          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? "" : "rotate-180"}`} />
        </button>
        {open && (
          <div id={panelId} role="radiogroup" aria-label="Look"
            className="theme-picker-menu absolute bottom-full left-3 right-3 mb-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5">
            {THEMES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={current === t.id} onClick={() => choose(t.id)}
                title={t.hint}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                <span className="relative w-6 h-6 rounded-md overflow-hidden border border-gray-200 flex-shrink-0">
                  <Swatch colors={t.swatch} />
                </span>
                <span className="flex-1 text-left">{t.name}</span>
                {current === t.id && <Check className="w-4 h-4 text-gray-900" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={root} className="theme-picker">
      <button ref={toggle} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}
        className="theme-picker-toggle inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
        {currentName ?? "Look"}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id={panelId} className="theme-picker-panel mt-4">
          <p className="text-sm text-gray-500 mb-4">
            How the whole site looks, on this device. Inspired by Gen X Soft Club, Acid Design, Early
            Cyber and Cyberdelia; Classic is the original.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" role="radiogroup" aria-label="Look">
            {THEMES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={current === t.id} onClick={() => choose(t.id)}
                className={`theme-swatch-card flex flex-col text-left bg-white border rounded-xl p-3 transition-all hover:shadow-md ${
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
        </div>
      )}
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
