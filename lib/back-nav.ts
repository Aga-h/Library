/**
 * Where the floating back button goes.
 *
 * The page-level arrows ("Back to Books", the finances "Portal" link) are ordinary links to a
 * parent. Cancel buttons call `router.back()`, which will also leave the site if this tab was
 * opened from somewhere else. This module is the shared decision for the floating button:
 * step back through this tab's own pages when that stays on the site, and otherwise go to the
 * same parent those arrows use. It never returns an external URL.
 *
 * The trail is this tab's in-site pages only. `depth` is how many browser-history steps from
 * the current entry are still inside the site — a refresh keeps it (the history entry is
 * still there), a new tab does not (sessionStorage is empty), and an external referrer starts
 * it at zero so the button will not walk out to that site.
 */

import { APP_TIME_ZONE } from "@/lib/dates";

export const BACK_SCROLL_PX = 144;
export const BACK_OVERFLOW_PX = 144;
const MAX_TRAIL = 40;
const ID_SEGMENT = /^[A-Za-z0-9_-]{1,80}$/;

export type Trail = {
  /** In-site paths, oldest first. Search is kept; the hash is not. */
  entries: string[];
  /** Index of the page currently showing. */
  index: number;
  /** Browser-history steps that still land on this site. */
  depth: number;
};

export const EMPTY_TRAIL: Trail = { entries: [], index: -1, depth: 0 };

export type BackDecision =
  | { type: "history" }
  | { type: "href"; href: string }
  | { type: "none" };

/** Path plus search, or null when it is not a same-site path. */
export function normalizePath(input: string): string | null {
  if (typeof input !== "string" || input.length === 0 || input.length > 2000) return null;
  if (!input.startsWith("/") || input.startsWith("//") || input.startsWith("/\\")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(input)) return null;
  const hashless = input.split("#")[0];
  let url: URL;
  try {
    url = new URL(hashless, "http://portal.local");
  } catch {
    return null;
  }
  if (url.origin !== "http://portal.local") return null;
  let path = url.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (!path.startsWith("/") || path.includes("\\")) return null;
  return path + url.search;
}

export function sameDestination(a: string, b: string): boolean {
  const left = normalizePath(a);
  const right = normalizePath(b);
  return left !== null && left === right;
}

export function referrerPath(referrer: string, origin: string): string | null {
  if (!referrer || !origin) return null;
  let url: URL;
  let home: URL;
  try {
    url = new URL(referrer);
    home = new URL(origin);
  } catch {
    return null;
  }
  if (url.origin !== home.origin) return null;
  return normalizePath(url.pathname + url.search);
}

export function currentHref(pathname: string, search: string): string {
  const query = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  return normalizePath(`${pathname}${query}`) ?? "/";
}

/**
 * A full load. A stored trail whose current entry is this page is a refresh — history still
 * matches, including `depth`. Anything else is a new entry: continue from a same-site
 * referrer, or start fresh so an external referrer is not a back target.
 */
export function restoreTrail(
  stored: Trail | null,
  current: string,
  referrer: string | null,
  origin: string,
): Trail {
  const here = normalizePath(current);
  if (!here) return { entries: ["/"], index: 0, depth: 0 };
  if (stored && stored.entries[stored.index] === here) return stored;

  const from = referrer ? referrerPath(referrer, origin) : null;
  if (from && from !== here && usableDestination(from, here)) {
    if (stored && stored.entries[stored.index] === from) return recordPush(stored, here);
    return { entries: [from, here], index: 1, depth: 1 };
  }
  return { entries: [here], index: 0, depth: 0 };
}

export type NavEvent = "push" | "replace" | "pop" | "fallback";

/** Record one navigation. `fallback` is the button climbing to a parent: the browser's
 *  previous entry is then the page just left, so depth goes back to zero and the next press
 *  climbs again instead of returning there. */
export function applyNavigation(trail: Trail, href: string, event: NavEvent): Trail {
  const next = normalizePath(href);
  if (!next) return trail;
  if (trail.entries.length === 0 || trail.index < 0) {
    return { entries: [next], index: 0, depth: 0 };
  }
  if (event === "fallback") return { entries: [next], index: 0, depth: 0 };
  if (event === "pop") return recordPop(trail, next);
  if (event === "replace") return recordReplace(trail, next);
  return recordPush(trail, next);
}

export function decideBack(trail: Trail, current: string, now: Date = new Date()): BackDecision {
  const here = normalizePath(current);
  if (!here || pathnameOf(here) === "/login") return { type: "none" };

  // The browser's previous entry is the trail's previous entry only while `depth` says so.
  // A redirecting entry (`/finances`, an old `/wardrobe` path) is skipped: stepping onto it
  // sends the user straight back here.
  if (trail.depth >= 1 && trail.index >= 1) {
    const prev = trail.entries[trail.index - 1];
    if (prev && usableDestination(prev, here)) return { type: "history" };
    for (let i = trail.index - 2; i >= 0; i--) {
      const candidate = trail.entries[i];
      if (candidate && usableDestination(candidate, here)) return { type: "href", href: candidate };
    }
  }

  const fallback = parentFallback(here, now);
  if (!fallback || !usableDestination(fallback, here)) return { type: "none" };
  return { type: "href", href: fallback };
}

/**
 * The parent the page's own back arrow links to, derived from the path (those arrows are
 * spread across the pages and are not changed here). Section roots go to the portal, which
 * is what "Back to Portal" does. A `new` page opened from a series or universe keeps that
 * parent, matching the link on that page.
 */
export function parentFallback(href: string, now: Date = new Date()): string | null {
  const here = normalizePath(href);
  if (!here) return null;
  const path = pathnameOf(here);
  if (path === "/" || path === "/login") return null;

  // `/finances` itself redirects at the current month, so it is not a parent. The month
  // header's arrow goes to the portal; the logger's arrow goes to this month.
  if (path === "/finances" || /^\/finances\/\d+\/\d+$/.test(path)) return "/";
  if (path === "/finances/log") return financesMonth(now);

  if (path === "/library/anime/import") return "/library/anime/new";

  const search = new URLSearchParams(searchOf(here));
  const seriesId = idSegment(search.get("seriesId"));
  if (seriesId && /^\/library\/(books|anime|tv)\/new$/.test(path)) {
    return `/library/${path.split("/")[2]}/s/${seriesId}`;
  }
  const universeId = idSegment(search.get("universeId"));
  if (universeId && path === "/library/movies/new") return `/library/movies/u/${universeId}`;

  const parts = path.split("/").filter(Boolean);
  // Books, anime, TV and movies use `s` and `u` as route markers, not pages. Comics uses
  // real ids in those positions, so a universe whose id is "u" must stay.
  const hierarchical = parts[0] === "library" && ["books", "anime", "tv", "movies"].includes(parts[1] ?? "");
  if (hierarchical && parts.at(-1) === "new" && (parts.at(-2) === "s" || parts.at(-2) === "u")) parts.splice(-2, 2);
  else parts.pop();
  if (hierarchical) while (parts.at(-1) === "s" || parts.at(-1) === "u") parts.pop();
  if (parts.length === 0) return "/";
  const parent = "/" + parts.join("/");
  return parent === path ? null : parent;
}

/** Long enough to scroll the top back link off, and scrolled far enough that it has gone. */
export function shouldShowFloatingBack(
  scrolled: number,
  overflow: number,
  hasDestination: boolean,
  blocked: boolean,
): boolean {
  if (!hasDestination || blocked) return false;
  if (overflow <= BACK_OVERFLOW_PX) return false;
  if (scrolled <= BACK_SCROLL_PX) return false;
  return true;
}

export function parseTrail(raw: string | null): Trail | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const entries = (value as { entries?: unknown }).entries;
  const index = (value as { index?: unknown }).index;
  const depth = (value as { depth?: unknown }).depth;
  if (!Array.isArray(entries) || typeof index !== "number" || typeof depth !== "number") return null;
  if (!Number.isInteger(index) || !Number.isInteger(depth)) return null;
  const clean: string[] = [];
  for (const entry of entries) {
    if (typeof entry !== "string") return null;
    const href = normalizePath(entry);
    if (!href) return null;
    clean.push(href);
  }
  if (clean.length === 0 || index < 0 || index >= clean.length || depth < 0) return null;
  return trimTrail({ entries: clean, index, depth: Math.min(depth, index) });
}

function recordPush(trail: Trail, href: string): Trail {
  if (trail.entries[trail.index] === href) return trail;
  const entries = trail.entries.slice(0, trail.index + 1);
  entries.push(href);
  return trimTrail({ entries, index: entries.length - 1, depth: trail.depth + 1 });
}

function recordReplace(trail: Trail, href: string): Trail {
  if (trail.entries[trail.index] === href) return trail;
  const entries = trail.entries.slice();
  entries[trail.index] = href;
  return { ...trail, entries };
}

function recordPop(trail: Trail, href: string): Trail {
  if (trail.entries[trail.index] === href) return trail;
  for (let i = trail.index - 1; i >= 0; i--) {
    if (trail.entries[i] === href) {
      const steps = trail.index - i;
      return { ...trail, index: i, depth: Math.max(0, trail.depth - steps) };
    }
  }
  for (let i = trail.index + 1; i < trail.entries.length; i++) {
    if (trail.entries[i] === href) {
      const steps = i - trail.index;
      return { ...trail, index: i, depth: trail.depth + steps };
    }
  }
  // Landed on a page this tab has no record of. Don't assume the one before it is ours.
  return { entries: [href], index: 0, depth: 0 };
}

function trimTrail(trail: Trail): Trail {
  if (trail.entries.length <= MAX_TRAIL) {
    return { ...trail, depth: Math.max(0, Math.min(trail.depth, trail.index)) };
  }
  const drop = trail.entries.length - MAX_TRAIL;
  const index = trail.index - drop;
  if (index < 0) return { entries: [trail.entries[trail.entries.length - 1]], index: 0, depth: 0 };
  return {
    entries: trail.entries.slice(drop),
    index,
    depth: Math.max(0, Math.min(trail.depth - drop, index)),
  };
}

/** Pages that redirect. Stepping onto them from their destination comes straight back. */
function usableDestination(href: string, here: string): boolean {
  if (sameDestination(href, here)) return false;
  const path = pathnameOf(href);
  if (path === "/login" || path === "/finances") return false;
  if (path === "/wardrobe" || path.startsWith("/wardrobe/")) return false;
  return true;
}

function financesMonth(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) return "/";
  return `/finances/${year}/${Number(month)}`;
}

function pathnameOf(href: string): string {
  const query = href.indexOf("?");
  return query === -1 ? href : href.slice(0, query);
}

function searchOf(href: string): string {
  const query = href.indexOf("?");
  return query === -1 ? "" : href.slice(query + 1);
}

function idSegment(value: string | null): string | null {
  if (!value || !ID_SEGMENT.test(value)) return null;
  return value;
}
