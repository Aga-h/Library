const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isSupabaseCover(url: string | null): boolean {
  return !!url && url.includes("/storage/v1/object/public/covers/");
}

export function thumbUrl(url: string | null, width: number, quality = 75): string | null {
  if (!url) return null;
  if (!isSupabaseCover(url)) return url;
  return `${url.replace("/object/", "/render/image/")}?width=${width}&quality=${quality}&format=webp`;
}

export async function mirrorCover(sourceUrl: string, path: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to fetch cover: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return uploadCover(buffer, path, contentType);
}

export async function uploadCover(buffer: ArrayBuffer, path: string, contentType: string): Promise<string> {
  const url = `${SUPABASE_URL}/storage/v1/object/covers/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upload failed: ${res.status} ${text}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/covers/${path}`;
}

export async function deleteCover(path: string): Promise<void> {
  const url = `${SUPABASE_URL}/storage/v1/object/covers/${path}`;
  await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${SERVICE_KEY}` },
  });
}
