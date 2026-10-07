// Shopping: the shops you have tried, filed by category, with what you liked and what you didn't.
// Pure helpers — no database — so the rules here are tested directly (scripts/test-shopping.mjs).

/** Suggested when adding a shop, alongside every category already in use. */
export const DEFAULT_CATEGORIES = [
  "Clothing", "Shoes", "Accessories", "Tech", "Gaming", "Home", "Beauty", "Books", "Sports", "Food",
];

export const NAME_MAX = 120;
export const PRODUCT_NAME_MAX = 160;
export const CATEGORY_MAX = 60;
export const NOTE_MAX = 4000;

/**
 * A shop's address as typed — "zara.com", "https://www.zara.com/tr/" — made into a full URL, or
 * null if it is not a web address. Only http and https: the URL becomes a link on the page, and a
 * "javascript:" one would run code when clicked.
 */
export function normaliseShopUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  // No scheme typed: assume https. A scheme other than http(s) is refused below, not rewritten.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // A real site has a dotted host name; "https://shop" is a typo, not a shop.
  if (!/^[^.]+(\.[^.]+)+$/.test(url.hostname)) return null;
  if (url.username || url.password) return null;
  return url.href;
}

/** The host to show under a shop's name: "www.zara.com" → "zara.com". */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Second-level labels that sit between a brand and a country code: boyner.com.tr, amazon.co.uk.
const GENERIC_SECOND_LEVEL = new Set(["co", "com", "net", "org", "gov", "edu", "ac", "gen", "web", "biz"]);

/**
 * A name to start from, taken from the address: "https://www.boyner.com.tr/" → "Boyner". Only a
 * suggestion — the form fills it in and you can change it.
 */
export function nameFromUrl(url: string): string {
  const labels = hostOf(url).split(".").filter(Boolean);
  if (labels.length === 0) return "";
  labels.pop(); // the top-level domain
  if (labels.length >= 2 && GENERIC_SECOND_LEVEL.has(labels[labels.length - 1].toLowerCase())) labels.pop();
  const brand = labels[labels.length - 1] ?? "";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

/** Tidies a typed category: trimmed, inner spaces collapsed. */
export function cleanCategory(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/**
 * The category a shop is filed under. Typing "clothing" when "Clothing" already exists files it
 * with the others, rather than starting a second, near-identical category.
 */
export function canonicalCategory(input: string, existing: readonly string[]): string {
  const clean = cleanCategory(input);
  const match = existing.find((c) => c.toLowerCase() === clean.toLowerCase());
  return match ?? clean;
}

/** Every category to offer when filing a shop: the ones in use first, then the suggestions. */
export function categoryOptions(inUse: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of [...[...inUse].sort((a, b) => a.localeCompare(b)), ...DEFAULT_CATEGORIES]) {
    const key = c.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

export interface ShopLike {
  id: string;
  name: string;
  url: string;
  category: string;
  liked: string | null;
  disliked: string | null;
  /** The things bought there, each with its own comment. */
  products?: readonly { name: string; comment: string | null }[];
}

/** Shops filed by category: categories A–Z, and shops A–Z within each. */
export function groupByCategory<T extends ShopLike>(shops: readonly T[]): { category: string; shops: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const s of shops) {
    const list = groups.get(s.category) ?? [];
    list.push(s);
    groups.set(s.category, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, list]) => ({ category, shops: [...list].sort((a, b) => a.name.localeCompare(b.name)) }));
}

/** The shops matching a search — name, address, category, notes, or a product and its comment —
 *  in one category or all. */
export function filterShops<T extends ShopLike>(shops: readonly T[], { q, category }: { q?: string; category?: string }): T[] {
  const needle = (q ?? "").trim().toLowerCase();
  return shops.filter((s) => {
    if (category && s.category !== category) return false;
    if (!needle) return true;
    const fields = [s.name, hostOf(s.url), s.category, s.liked ?? "", s.disliked ?? ""];
    for (const p of s.products ?? []) fields.push(p.name, p.comment ?? "");
    return fields.some((f) => f.toLowerCase().includes(needle));
  });
}

/**
 * A short code per category, for its line on the map — the first letter, like a metro line, or
 * the first two when an earlier line already took that letter. Each shop is then a numbered
 * station on its line: C01, C02.
 */
export function lineCodes(categories: readonly string[]): Map<string, string> {
  const codes = new Map<string, string>();
  const taken = new Set<string>();
  for (const category of categories) {
    const letters = category.replace(/[^\p{L}\p{N}]/gu, "").toUpperCase() || "X";
    let code = letters.slice(0, 1);
    for (let n = 2; taken.has(code) && n <= letters.length; n++) code = letters.slice(0, n);
    // Every letter of it already taken: number it.
    for (let i = 2; taken.has(code); i++) code = `${letters.slice(0, 1)}${i}`;
    taken.add(code);
    codes.set(category, code);
  }
  return codes;
}

export function stationCode(lineCode: string, index: number): string {
  return `${lineCode}${String(index + 1).padStart(2, "0")}`;
}

// Each line's colour: the obvious ones are fixed, the rest are spread over the remaining hues by
// the category's name, so a category keeps its colour as others come and go.
const FIXED_HUES: Record<string, string> = {
  clothing: "pink", shoes: "rose", accessories: "fuchsia", tech: "blue", gaming: "violet",
  home: "amber", beauty: "rose", books: "orange", sports: "emerald", food: "lime",
};
const HUES = ["sky", "teal", "indigo", "cyan", "orange", "emerald", "purple", "amber", "fuchsia", "lime"];

/** The Tailwind hue a category's line is drawn in — a palette name, so every look recolours it. */
export function lineHue(category: string): string {
  const key = category.toLowerCase();
  if (FIXED_HUES[key]) return FIXED_HUES[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return HUES[h % HUES.length];
}
