import { NextRequest, NextResponse } from "next/server";
import { uploadCover, deleteCover } from "@/lib/covers";
import { withErrors } from "@/lib/api-errors";

// Extension is derived from the verified MIME type, never from the client's filename.
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
  ["image/gif", "gif"],
]);

const MAX_BYTES = 5 * 1024 * 1024;

// Storage folders the app is allowed to write to. The client picks one by name; it never
// supplies a path, because a client-controlled path can escape the bucket via "..".
const ALLOWED_FOLDERS = new Set([
  "books", "anime", "movies", "tv", "games", "manga", "articles", "wardrobe", "uploads",
  "comic-issues",
]);

async function POSTHandler(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const folder = form.get("folder");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof folder !== "string" || !ALLOWED_FOLDERS.has(folder)) {
    return NextResponse.json({ error: "Unknown upload folder" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES.get(file.type);
  if (!ext) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is larger than 5MB" }, { status: 413 });
  }

  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  try {
    const buffer = await file.arrayBuffer();
    const url = await uploadCover(buffer, path, file.type);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[upload] POST failed:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }
}

async function DELETEHandler(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  // Must be exactly "<allowed-folder>/<filename>" with no traversal.
  const segments = path.split("/");
  if (segments.length !== 2 || !ALLOWED_FOLDERS.has(segments[0]) || !/^[\w.-]+$/.test(segments[1])) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    await deleteCover(path);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[upload] DELETE failed:", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 502 });
  }
}

export const POST = withErrors(POSTHandler);
export const DELETE = withErrors(DELETEHandler);
