// Fetching JSON from the site's own API during a long import — hundreds of requests that each
// reach MyAnimeList, which rate-limits them. Client-side: used by the anime and manga list imports.

export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Worth asking again after a pause: rate-limited, MyAnimeList or the site briefly down, timed out. */
const PASSING = new Set([0, 429, 500, 502, 503, 504]);
/** Pauses between tries — a long list is hundreds of requests, and MyAnimeList rate-limits them. */
const BACKOFF = [5_000, 10_000, 20_000, 30_000, 45_000];

export async function getJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  for (let attempt = 0; ; attempt++) {
    let status = 0;
    let data: Record<string, unknown> = {};
    try {
      const res = await fetch(url, init);
      status = res.status;
      data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, status, data };
    } catch {
      // The connection dropped: status 0, tried again like a timeout.
    }
    // 503 with a message is MyAnimeList not being set up on the site — waiting won't fix that.
    const notSetUp = status === 503 && typeof data.error === "string" && data.error.includes("MAL_CLIENT_ID");
    if (!PASSING.has(status) || notSetUp || attempt >= BACKOFF.length) {
      return { ok: false, status, data: status === 0 ? { error: "Lost the connection to the site." } : data };
    }
    await pause(BACKOFF[attempt]);
  }
}
