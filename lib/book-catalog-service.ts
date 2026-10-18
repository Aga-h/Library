// Searching both book catalogues at once, and fetching the rows an import needs. Server-only.
// Open Library is required; Google Books is best-effort — a 403/429 there must not hide Open
// Library hits. Pure merge rules live in lib/google-books.ts.

import { BookCatalogError, hasPages, type CatalogBook, type OlWork } from "@/lib/openlibrary";
import { combineSources, mergeCatalog, type GbVolume } from "@/lib/google-books";
import { OpenLibraryError, searchWorks, workById } from "@/lib/openlibrary-service";
import { GoogleBooksError, searchVolumes, volumeById } from "@/lib/google-books-service";

const CONCURRENCY = 3;

export interface CatalogItem {
  openLibraryId?: string;
  googleBooksId?: string;
}

export interface CatalogSearch {
  works: CatalogBook[];
  /** Set when Google Books could not be searched, so Open Library-only results are explained. */
  notice: string | null;
}

function catalogIdOf(item: CatalogItem): string {
  return item.openLibraryId ?? (item.googleBooksId ? `gb:${item.googleBooksId}` : "");
}

/**
 * Works matching a search. Open Library and Google Books run together; Google Books failing
 * (no key, quota, outage) leaves Open Library's list intact plus a notice. Both failing is
 * still an error.
 */
export async function searchCatalog(query: string): Promise<CatalogSearch> {
  const [ol, gb] = await Promise.allSettled([searchWorks(query), searchVolumes(query)]);
  const olWorks = ol.status === "fulfilled" ? ol.value : [];
  const gbVolumes = gb.status === "fulfilled" ? gb.value : [];

  if (ol.status === "rejected" && gb.status === "rejected") {
    const err = ol.reason;
    if (err instanceof BookCatalogError) throw err;
    throw err;
  }

  let notice: string | null = null;
  if (gb.status === "rejected") {
    notice = gb.reason instanceof GoogleBooksError
      ? gb.reason.message
      : "Google Books couldn't be searched — showing Open Library only.";
  }

  return { works: mergeCatalog(olWorks, gbVolumes, query), notice };
}

export interface CatalogDetails {
  works: (CatalogBook & { pages: number })[];
  failed: { id: string; reason: string }[];
}

/**
 * Each item's details, a few at a time. A source that 404s is skipped if the other source
 * still has the book; a missing page count is reported rather than failing the batch. A rate
 * limit or outage on a source still throws when that source is the only one for the item.
 */
export async function catalogDetails(items: CatalogItem[]): Promise<CatalogDetails> {
  const unique: CatalogItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const id = catalogIdOf(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push({
      ...(item.openLibraryId ? { openLibraryId: item.openLibraryId } : {}),
      ...(item.googleBooksId ? { googleBooksId: item.googleBooksId } : {}),
    });
  }

  const works: (CatalogBook & { pages: number })[] = [];
  const failed: { id: string; reason: string }[] = [];
  let next = 0;

  async function one(item: CatalogItem): Promise<void> {
    const id = catalogIdOf(item);
    let ol: OlWork | null = null;
    let gb: GbVolume | null = null;

    if (item.openLibraryId) {
      try {
        ol = await workById(item.openLibraryId);
      } catch (e) {
        if (!(e instanceof OpenLibraryError) || (e.status !== 404 && e.status !== 400)) throw e;
      }
    }
    if (item.googleBooksId) {
      try {
        gb = await volumeById(item.googleBooksId);
      } catch (e) {
        if (e instanceof GoogleBooksError && (e.status === 404 || e.status === 400)) {
          gb = null;
        } else if (ol && hasPages(ol)) {
          gb = null;
        } else {
          throw e;
        }
      }
    }

    const combined = combineSources(ol, gb);
    if (!combined) {
      failed.push({ id, reason: "not found in the catalogues" });
      return;
    }
    if (!hasPages(combined)) {
      failed.push({ id, reason: "No page count on Open Library or Google Books — add it by hand" });
      return;
    }
    works.push(combined);
  }

  async function worker() {
    while (next < unique.length) {
      const item = unique[next++];
      await one(item);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, () => worker()));
  return { works, failed };
}
