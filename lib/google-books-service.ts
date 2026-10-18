// Talking to Google Books. Server-only: it reads GOOGLE_BOOKS_API_KEY, which must never reach
// a browser. Pure rules live in lib/google-books.ts.
//
// Only documented endpoints: GET /books/v1/volumes (search) and GET /books/v1/volumes/{id}.
// The key is optional — public data still answers without it until the anonymous quota dies.
// Overridable GOOGLE_BOOKS_BASE_URL so the importer can be tested against a local stand-in;
// production never sets it.

import { BookCatalogError, MAX_IMPORT } from "@/lib/openlibrary";
import {
  googleSearchQueryOf, googleVolumeIdOf, toVolume, type GbVolume,
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
        : "Google Books is limited without GOOGLE_BOOKS_API_KEY — some titles may be missing.",
      429,
    );
  }
  if (res.status === 403) {
    throw new GoogleBooksError(
      apiKey()
        ? "Google Books refused the API key — enable the Books API and check GOOGLE_BOOKS_API_KEY."
        : "Google Books is limited without GOOGLE_BOOKS_API_KEY — some titles may be missing.",
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
  const body = await get("/volumes", {
    q,
    maxResults: String(MAX_IMPORT),
    printType: "books",
    projection: "lite",
  });
  return volumesOf(body);
}

/** One volume, by its Google Books id. */
export async function volumeById(id: string): Promise<GbVolume> {
  const key = googleVolumeIdOf(id);
  if (!key) throw new GoogleBooksError("That isn't a Google Books volume id.", 400);
  const found = toVolume(await get(`/volumes/${encodeURIComponent(key)}`, { projection: "lite" }));
  if (!found || found.id !== key) throw new GoogleBooksError("That isn't on Google Books.", 404);
  return found;
}
