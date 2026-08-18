const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isSupabaseCover(url: string | null): boolean {
  return !!url && url.includes("/storage/v1/object/public/covers/");
}

async function fetchResilient(url: string, retries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.ok || ![408, 429, 500, 502, 503, 504].includes(res.status)) return res;
      const retryAfter = res.headers.get("retry-after");
      const backoff = retryAfter
        ? Number(retryAfter) * 1_000
        : Math.min(10_000, 500 * 2 ** (attempt - 1) + Math.random() * 500);
      if (attempt < retries) await new Promise(r => setTimeout(r, backoff));
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise(r => setTimeout(r, Math.min(10_000, 500 * 2 ** (attempt - 1) + Math.random() * 500)));
    }
  }
  throw new Error(`All ${retries} attempts failed: ${url}`);
}

export async function mirrorCover(sourceUrl: string, path: string): Promise<string> {
  const res = await fetchResilient(sourceUrl);
  if (!res.ok) throw new Error(`Failed to fetch cover: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return uploadCover(buffer, path, contentType);
}

/** Encode each segment so a stray ".." or "?" cannot re-target the request URL. */
function safePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function uploadCover(buffer: ArrayBuffer, path: string, contentType: string): Promise<string> {
  const encoded = safePath(path);
  const url = `${SUPABASE_URL}/storage/v1/object/covers/${encoded}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upload failed: ${res.status} ${text}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/covers/${encoded}`;
}

export async function deleteCover(path: string): Promise<void> {
  const url = `${SUPABASE_URL}/storage/v1/object/covers/${safePath(path)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  });
  // A 404 is fine (already gone); anything else means the object is still there.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Supabase delete failed: ${res.status}`);
  }
}
