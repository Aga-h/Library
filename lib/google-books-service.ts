// Talking to Google Books. Server-only: it reads GOOGLE_BOOKS_API_KEY, which must never reach
// a browser. Pure rules live in lib/google-books.ts.
//
// Only documented endpoints: GET /books/v1/volumes (search) and GET /books/v1/volumes/{id}.
// The key is optional until Google's anonymous quota dies; Add Book has no other catalogue,
// so a 403/429 without a key is an error, not a partial list.
// Overridable GOOGLE_BOOKS_BASE_URL so the importer can be tested against a local stand-in;
// production never sets it.

import { BookCatalogError, MAX_IMPORT } from "@/lib/openlibrary";
import {
  googleSearchQueryOf, googleVolumeIdOf, toVolume, volumesToRefetch, type GbVolume,
} from "@/lib/google-books";

function baseUrl(): string {
  return (process.env.GOOGLE_BOOKS_BASE_URL ?? "https://www.googleapis.com/books/v1").replace(/\/$/, "");
}

export class GoogleBooksError extends BookCatalogError {}

type Raw = Record<string, unknown>;

function apiKey(): string | null {
  const key = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  return key || null;
}

async function get(path: string, params: Record<string, string> = {}): Promise<Raw> {
  const url = new URL(`${baseUrl()}${path}`);
  const search = new URLSearchParams(params);
  const key = apiKey();
  if (key) search.set("key", key);
  url.search = search.toString();

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new GoogleBooksError("Couldn't reach Google Books — try again in a minute.", 502);
  }

  if (res.status === 404) throw new GoogleBooksError("That isn't on Google Books.", 404);
  if (res.status === 429) {
    throw new GoogleBooksError(
      apiKey()
        ? "Google Books is rate-limiting requests — wait a moment and try again."
        : "Google Books needs GOOGLE_BOOKS_API_KEY — set it in Vercel, enable the Books API, and redeploy.",
      429,
    );
  }
  if (res.status === 403) {
    throw new GoogleBooksError(
      apiKey()
        ? "Google Books refused the API key — enable the Books API and check GOOGLE_BOOKS_API_KEY."
        : "Google Books needs GOOGLE_BOOKS_API_KEY — set it in Vercel, enable the Books API, and redeploy.",
      403,
    );
  }
  const body = (await res.json().catch(() => null)) as Raw | null;
  if (!res.ok || !body) throw new GoogleBooksError(`Google Books answered ${res.status}.`, 502);
  return body;
}

function volumesOf(body: Raw): GbVolume[] {
  const rows = Array.isArray(body.items) ? (body.items as Raw[]) : [];
  const volumes: GbVolume[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const volume = toVolume(row);
    if (!volume || seen.has(volume.id)) continue;
    seen.add(volume.id);
    volumes.push(volume);
  }
  return volumes;
}

/** Volumes matching a search, in Google's relevance order. Magazines excluded. */
export async function searchVolumes(query: string): Promise<GbVolume[]> {
  const asked = googleSearchQueryOf(query);
  if (asked.kind === "id") {
    try {
      return [await volumeById(asked.value)];
    } catch (e) {
      if (e instanceof GoogleBooksError && e.status === 404) return [];
      throw e;
    }
  }
  const q = asked.kind === "isbn" ? `isbn:${asked.value}` : asked.value;
  if (!q) return [];
  const params: Record<string, string> = {
    q,
    maxResults: String(MAX_IMPORT),
    printType: "books",
    projection: "full",
  };
  // Title search stays in English. An ISBN or a volume id is a specific edition and is left as it is.
  if (asked.kind === "text") params.langRestrict = "en";
  const first = await get("/volumes", params);
  const rows = Array.isArray(first.items) ? [...(first.items as Raw[])] : [];
  const total = Number(first.totalItems) || rows.length;
  // A second page so a paperback buried under Kindle listings can still be collapsed in.
  if (total > rows.length) {
    const second = await get("/volumes", { ...params, startIndex: String(rows.length) });
    if (Array.isArray(second.items)) rows.push(...(second.items as Raw[]));
  }
  return refillBlankPages(volumesOf({ items: rows }), asked.value);
}

/**
 * `volumes.list` often says a paperback has no page count. `volumes.get` for that same id
 * has the count the Google Books site shows. A failure here leaves the list as it was.
 */
async function refillBlankPages(volumes: GbVolume[], query: string): Promise<GbVolume[]> {
  const pending = volumesToRefetch(volumes, query);
  if (pending.length === 0) return volumes;
  const updates = new Map<string, GbVolume>();
  let next = 0;
  async function worker() {
    while (next < pending.length) {
      const id = pending[next++];
      try {
        const full = await volumeById(id);
        if (full.pages) updates.set(id, full);
      } catch (e) {
        if (e instanceof GoogleBooksError) continue;
        throw e;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, pending.length) }, () => worker()));
  if (updates.size === 0) return volumes;
  return volumes.map((volume) => updates.get(volume.id) ?? volume);
}

/** One volume, by its Google Books id. */
export async function volumeById(id: string): Promise<GbVolume> {
  const key = googleVolumeIdOf(id);
  if (!key) throw new GoogleBooksError("That isn't a Google Books volume id.", 400);
  const found = toVolume(await get(`/volumes/${encodeURIComponent(key)}`, { projection: "full" }));
  if (!found || found.id !== key) throw new GoogleBooksError("That isn't on Google Books.", 404);
  return found;
}
