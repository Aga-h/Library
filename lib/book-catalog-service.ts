// Searching Google Books and fetching the rows an import needs. Server-only.
// Pure list rules live in lib/google-books.ts.

import { hasPages, type CatalogBook } from "@/lib/openlibrary";
import { catalogFromVolumes, editionsFromVolumes, fromGbVolume, type CatalogEdition } from "@/lib/google-books";
import { GoogleBooksError, editionVolumes, searchVolumes, volumeById } from "@/lib/google-books-service";

const CONCURRENCY = 3;

export interface CatalogItem {
  googleBooksId: string;
  /** Title shown in search — kept on import so Google's edition title is what you picked. */
  title?: string;
}

export interface CatalogSearch {
  works: Array<CatalogBook & { pages: number }>;
}

function catalogIdOf(item: CatalogItem): string {
  return item.googleBooksId ? `gb:${item.googleBooksId}` : "";
}

/** Volumes matching a search that have a page count (required to import). */
export async function searchCatalog(query: string): Promise<CatalogSearch> {
  return { works: catalogFromVolumes(await searchVolumes(query), query) };
}

/** Every edition of one novel Google Books lists with a page count, for the cover flow. */
export async function searchEditions(book: { title: string; author: string }): Promise<CatalogEdition[]> {
  return editionsFromVolumes(await editionVolumes(book), book);
}

export interface CatalogDetails {
  works: (CatalogBook & { pages: number })[];
  failed: { id: string; reason: string }[];
}

/**
 * Each item's details, a few at a time. A missing volume or page count is reported rather than
 * failing the batch. A rate limit or outage still throws.
 */
export async function catalogDetails(items: CatalogItem[]): Promise<CatalogDetails> {
  const unique: CatalogItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const id = catalogIdOf(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push({
      googleBooksId: item.googleBooksId,
      ...(item.title?.trim() ? { title: item.title.trim() } : {}),
    });
  }

  const works: (CatalogBook & { pages: number })[] = [];
  const failed: { id: string; reason: string }[] = [];
  let next = 0;

  async function one(item: CatalogItem): Promise<void> {
    const id = catalogIdOf(item);
    let volume;
    try {
      volume = await volumeById(item.googleBooksId);
    } catch (e) {
      if (e instanceof GoogleBooksError && (e.status === 404 || e.status === 400)) {
        failed.push({ id, reason: "not found on Google Books" });
        return;
      }
      throw e;
    }

    let book = fromGbVolume(volume);
    const preferred = item.title?.trim();
    if (preferred) book = { ...book, title: preferred };
    if (!hasPages(book)) {
      failed.push({ id, reason: "No page count on Google Books — add it by hand" });
      return;
    }
    works.push(book);
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
