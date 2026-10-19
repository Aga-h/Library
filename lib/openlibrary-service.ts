// Talking to Open Library. Server-only. Pure rules live in lib/openlibrary.ts.
//
// Only documented endpoints: GET /search.json (works, ISBN, a work key). Covers are built from
// cover_i as https://covers.openlibrary.org/b/id/{id}-L.jpg — see coverUrl. No API key.
// Overridable OPENLIBRARY_BASE_URL so the importer can be tested against a local stand-in;
// production never sets it.

import {
  BookCatalogError, MAX_IMPORT, byYear, hasPages, isbnOf, searchQueryOf, toWork, workIdOf,
  type OlWork,
} from "@/lib/openlibrary";

const BASE_URL = (process.env.OPENLIBRARY_BASE_URL ?? "https://openlibrary.org").replace(/\/$/, "");

/** Open Library asks that automated clients identify themselves. */
const USER_AGENT = "MyPortal/1.0 (https://github.com/Aga-h/Library; personal media library)";

/** Search fields we actually use. `*` is expensive and pulls every edition's ISBN list.
 *  `editions` is the matching edition (often the English one when you searched in English) —
 *  the work title itself stays in the original script. */
const FIELDS = "key,title,author_name,first_publish_year,cover_i,number_of_pages_median,editions";

/** Requests in flight at once. Open Library does not publish a hard limit; this stays gentle. */
const CONCURRENCY = 3;

export class OpenLibraryError extends BookCatalogError {}

type Raw = Record<string, unknown>;

async function get(path: string, params: Record<string, string>): Promise<Raw> {
  const url = new URL(`${BASE_URL}${path}`);
  url.search = new URLSearchParams(params).toString();

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new OpenLibraryError("Couldn't reach Open Library — try again in a minute.", 502);
  }

  if (res.status === 404) throw new OpenLibraryError("That isn't on Open Library.", 404);
  if (res.status === 429) throw new OpenLibraryError("Open Library is rate-limiting requests — wait a moment and try again.", 429);
  const body = (await res.json().catch(() => null)) as Raw | null;
  if (!res.ok || !body) throw new OpenLibraryError(`Open Library answered ${res.status}.`, 502);
  return body;
}

function docsOf(body: Raw, query = ""): OlWork[] {
  const rows = Array.isArray(body.docs) ? (body.docs as Raw[]) : [];
  const works: OlWork[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const work = toWork(row, query);
    if (!work || seen.has(work.id)) continue;
    seen.add(work.id);
    works.push(work);
  }
  return works;
}

/** Works matching a search, in Open Library's relevance order. */
export async function searchWorks(query: string): Promise<OlWork[]> {
  const body = await get("/search.json", {
    q: searchQueryOf(query),
    fields: FIELDS,
    limit: String(MAX_IMPORT),
  });
  // A work id or ISBN lookup isn't a language hint — keep the catalogue's own title.
  const keyed = workIdOf(query) !== null || isbnOf(query) !== null;
  return docsOf(body, keyed ? "" : query);
}

/** One work, by its Open Library id. */
export async function workById(id: string): Promise<OlWork> {
  const key = workIdOf(id);
  if (!key) throw new OpenLibraryError("That isn't an Open Library work id.", 400);
  const found = (await searchWorks(key))[0];
  if (!found || found.id !== key) throw new OpenLibraryError("That isn't on Open Library.", 404);
  return found;
}

/**
 * Each work's details, a few at a time, in publish-year order. One Open Library cannot find
 * (or has no page count for) is reported rather than failing the batch — a rate limit or an
 * outage would fail every one of them, so those still throw.
 */
export async function workDetails(
  ids: string[],
): Promise<{ works: (OlWork & { pages: number })[]; failed: { openLibraryId: string; reason: string }[] }> {
  const unique = [...new Set(ids.map(workIdOf).filter((id): id is string => id !== null))];
  const works: (OlWork & { pages: number })[] = [];
  const failed: { openLibraryId: string; reason: string }[] = [];
  let next = 0;

  async function worker() {
    while (next < unique.length) {
      const id = unique[next++];
      try {
        const work = await workById(id);
        if (!hasPages(work)) {
          failed.push({ openLibraryId: id, reason: "Open Library doesn't know the page count — add it by hand" });
          continue;
        }
        works.push(work);
      } catch (e) {
        if (!(e instanceof OpenLibraryError) || (e.status !== 404 && e.status !== 400)) throw e;
        failed.push({ openLibraryId: id, reason: "not found on Open Library" });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, () => worker()));
  works.sort(byYear);
  return { works, failed };
}
