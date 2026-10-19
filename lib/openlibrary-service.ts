// Asking Open Library which book an ISBN is. Server-only. Google Books has answered every
// `isbn:` search with nothing since about 1 Oct 2026, so an ISBN is looked up here and the
// title it gives is searched on Google in plain words (lib/google-books-service.ts).
// Overridable OPEN_LIBRARY_BASE_URL so tests can use a local stand-in; production never sets it.

function baseUrl(): string {
  return (process.env.OPEN_LIBRARY_BASE_URL ?? "https://openlibrary.org").replace(/\/$/, "");
}

type Raw = Record<string, unknown>;

/** Open Library asks clients to say who they are; unnamed ones get one request a second. */
const HEADERS = { Accept: "application/json", "User-Agent": "Library (https://www.otuzbir.world)" };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A JSON document, or null — Open Library being down or not knowing the ISBN are the same here. */
async function getJson(path: string): Promise<Raw | null> {
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Raw) : null;
  } catch {
    return null;
  }
}

/** The title ("Mistborn: The Final Empire") and first author Open Library has for an ISBN. */
export async function bookByIsbn(isbn: string): Promise<{ title: string; author: string } | null> {
  const edition = await getJson(`/isbn/${encodeURIComponent(isbn)}.json`);
  const title = text(edition?.title);
  if (!edition || !title) return null;
  const subtitle = text(edition.subtitle);
  const authors = Array.isArray(edition.authors) ? (edition.authors as Raw[]) : [];
  const key = text(authors[0]?.key);
  const author = /^\/authors\/OL\d+A$/.test(key) ? text((await getJson(`${key}.json`))?.name) : "";
  return {
    title: subtitle && !title.toLowerCase().includes(subtitle.toLowerCase()) ? `${title}: ${subtitle}` : title,
    author: author || text(edition.by_statement).replace(/\.$/, "") || "Unknown",
  };
}
