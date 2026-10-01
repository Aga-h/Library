// Talking to Comic Vine. Server-only: it reads COMICVINE_API_KEY, which must never reach a
// browser. Pure rules live in lib/comicvine.ts.
//
// Only documented, filterable fields are used: /search?resources=volume, /volumes?filter=id:…
// and /issues?filter=volume:…&sort=issue_number:asc.

import { pickImage, type CvIssue, type CvVolume } from "@/lib/comicvine";

/** Overridable so the importer can be tested against a local stand-in; production never sets it. */
const BASE_URL = (process.env.COMICVINE_BASE_URL ?? "https://comicvine.gamespot.com/api").replace(/\/$/, "");

/** Comic Vine refuses requests without a descriptive User-Agent. */
const USER_AGENT = "MyPortal personal comic tracker";

/** The documented maximum page size for list resources. */
const PAGE_SIZE = 100;

/** A run longer than this is refused rather than half-imported. The longest Marvel run is ~1,000. */
const MAX_ISSUES = 3000;

export class ComicVineError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function apiKey(): string {
  const key = process.env.COMICVINE_API_KEY;
  if (!key) {
    throw new ComicVineError("Comic Vine isn't set up — add COMICVINE_API_KEY to the site's environment.", 503);
  }
  return key;
}

interface CvResponse {
  status_code: number;
  error: string;
  number_of_total_results: number;
  results: unknown;
}

async function get(path: string, params: Record<string, string>): Promise<CvResponse> {
  const url = new URL(`${BASE_URL}/${path}/`);
  url.search = new URLSearchParams({ ...params, api_key: apiKey(), format: "json" }).toString();

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new ComicVineError("Couldn't reach Comic Vine — try again in a minute.", 502);
  }

  if (res.status === 401) throw new ComicVineError("Comic Vine refused the API key — check COMICVINE_API_KEY.", 502);
  if (res.status === 420 || res.status === 429) {
    throw new ComicVineError("Comic Vine is rate-limiting requests — wait a few minutes and try again.", 429);
  }
  const body = (await res.json().catch(() => null)) as CvResponse | null;
  if (!res.ok || !body) throw new ComicVineError(`Comic Vine answered ${res.status}.`, 502);
  // status_code 1 is the API's own "OK"; anything else carries a reason in `error`.
  if (body.status_code !== 1) {
    if (body.status_code === 100) throw new ComicVineError("Comic Vine refused the API key — check COMICVINE_API_KEY.", 502);
    throw new ComicVineError(`Comic Vine: ${body.error || "unknown error"}`, 502);
  }
  return body;
}

type Raw = Record<string, unknown>;

function toVolume(raw: Raw): CvVolume | null {
  const id = Number(raw.id);
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!Number.isInteger(id) || id <= 0 || !name) return null;
  const year = Number(raw.start_year);
  const publisher = raw.publisher as Raw | null | undefined;
  return {
    id,
    name,
    startYear: Number.isInteger(year) && year > 1800 ? year : null,
    issueCount: Number(raw.count_of_issues) || 0,
    publisher: typeof publisher?.name === "string" ? publisher.name : null,
    image: pickImage(raw.image),
  };
}

function toIssue(raw: Raw): CvIssue | null {
  const id = Number(raw.id);
  if (!Number.isInteger(id)) return null;
  return {
    id,
    issueNumber: raw.issue_number == null ? "" : String(raw.issue_number),
    name: typeof raw.name === "string" ? raw.name : null,
    image: pickImage(raw.image),
  };
}

const VOLUME_FIELDS = "id,name,start_year,count_of_issues,publisher,image";

/** Runs matching a search, in Comic Vine's relevance order. */
export async function searchVolumes(query: string): Promise<CvVolume[]> {
  const body = await get("search", { resources: "volume", query, limit: "20", field_list: VOLUME_FIELDS });
  const results = Array.isArray(body.results) ? (body.results as Raw[]) : [];
  return results.map(toVolume).filter((v): v is CvVolume => v !== null);
}

/** One run and every issue in it, fetched a page of 100 at a time. */
export async function volumeWithIssues(volumeId: number): Promise<{ volume: CvVolume; issues: CvIssue[] }> {
  const head = await get("volumes", { filter: `id:${volumeId}`, field_list: VOLUME_FIELDS, limit: "1" });
  const volume = Array.isArray(head.results) ? toVolume((head.results as Raw[])[0] ?? {}) : null;
  if (!volume || volume.id !== volumeId) throw new ComicVineError("That series is not on Comic Vine.", 404);

  const issues: CvIssue[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await get("issues", {
      filter: `volume:${volumeId}`,
      sort: "issue_number:asc",
      field_list: "id,issue_number,name,image",
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    const rows = Array.isArray(page.results) ? (page.results as Raw[]) : [];
    for (const row of rows) {
      const issue = toIssue(row);
      if (issue) issues.push(issue);
    }
    if (page.number_of_total_results > MAX_ISSUES) {
      throw new ComicVineError(`That run has ${page.number_of_total_results} issues — too many to import at once.`, 422);
    }
    if (rows.length < PAGE_SIZE || offset + PAGE_SIZE >= page.number_of_total_results) break;
    // Comic Vine watches request velocity; a short pause between pages stays well clear of it.
    await new Promise((r) => setTimeout(r, 300));
  }
  return { volume, issues };
}
