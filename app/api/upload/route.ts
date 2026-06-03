import { NextRequest, NextResponse } from "next/server";
import { uploadCover, deleteCover } from "@/lib/covers";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const path = form.get("path") as string | null;
  if (!file || !path) {
    return NextResponse.json({ error: "file and path are required" }, { status: 400 });
  }
  const buffer = await file.arrayBuffer();
  try {
    const url = await uploadCover(buffer, path, file.type || "image/jpeg");
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path is required" }, { status: 400 });
  try {
    await deleteCover(path);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
