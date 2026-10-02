// Browser-side theme switching. Kept out of components: it writes to the document.

import { THEMES, THEME_COOKIE, themeFrom, type ThemeId } from "@/lib/themes";

/** Apply a theme now, and remember it on this device for a year so the server renders it next. */
export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
  document.cookie = `${THEME_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMES.find((t) => t.id === id)!.themeColor);
}

/** The theme on screen — the attribute the server rendered, or the last one applied. */
export function currentTheme(): ThemeId {
  return themeFrom(document.documentElement.dataset.theme);
}

/** Calls back whenever the theme changes, from any picker on the page. */
export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
