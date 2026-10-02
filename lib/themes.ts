// The site's looks. Each is a set of colour variables (app/theme-palettes.css, generated) plus a
// skin (app/themes.css), switched by `data-theme` on <html>. The choice lives in a cookie so the
// server renders the right look on the first paint — no flash of the wrong theme.
//
// Pure: imported by the root layout and by the client-side picker alike.

export const THEMES = [
  {
    id: "softclub",
    name: "Soft Club",
    hint: "Gen X Soft Club — an icy city in cyan haze, lime lights, subway roll signs",
    swatch: ["#eaf3f8", "#3fa9e0", "#b5dc35", "#0e1a24"],
    themeColor: "#eaf3f8",
  },
  {
    id: "acid",
    name: "Acid",
    hint: "Acid Design — black, chrome and fluorescent acid green",
    swatch: ["#0a0a0a", "#c6ff1a", "#d6d6d6", "#ff3fa4"],
    themeColor: "#0a0a0a",
  },
  {
    id: "earlycyber",
    name: "Early Cyber",
    hint: "Early Cyber — a 1-bit desktop with thermographic colour",
    swatch: ["#ffffff", "#000000", "#2b2bd6", "#ff6a00"],
    themeColor: "#ffffff",
  },
  {
    id: "cyberdelia",
    name: "Cyberdelia",
    hint: "Cyberdelia — ultraviolet night, acid colour and a wireframe floor",
    swatch: ["#07030f", "#00e5ff", "#b14bff", "#a6ff00"],
    themeColor: "#07030f",
  },
  {
    id: "classic",
    name: "Classic",
    hint: "The original plain grey look",
    swatch: ["#f9fafb", "#ffffff", "#9ca3af", "#111827"],
    themeColor: "#111827",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "softclub";

export const THEME_COOKIE = "theme";

/** A cookie's value as a theme — anything unknown or missing is the default. */
export function themeFrom(value: string | undefined | null): ThemeId {
  return THEMES.some((t) => t.id === value) ? (value as ThemeId) : DEFAULT_THEME;
}

export function themeColorOf(id: ThemeId): string {
  return THEMES.find((t) => t.id === id)!.themeColor;
}
