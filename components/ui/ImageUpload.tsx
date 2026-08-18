"use client";

import { useRef, useState } from "react";
import { Upload, X, RefreshCw } from "lucide-react";
import { isSupabaseCover } from "@/lib/covers";

interface Props {
  value: string;
  onChange: (url: string) => void;
  fieldName?: string; // used in storage path e.g. "books", "games"
}

async function deleteOldCover(url: string) {
  if (!isSupabaseCover(url)) return;
  // Extract path after /covers/
  const match = url.match(/\/covers\/(.+)$/);
  if (!match) return;
  await fetch(`/api/upload?path=${encodeURIComponent(match[1])}`, { method: "DELETE" });
}

export default function ImageUpload({ value, onChange, fieldName = "uploads" }: Props) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    // The server derives the storage key from `folder` + a UUID. The client never
    // supplies a path — one containing ".." could escape the covers bucket entirely.
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", fieldName);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      await deleteOldCover(value);
      onChange(data.url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    await deleteOldCover(value);
    onChange("");
  }

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="flex gap-2 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Cover preview" className="w-16 h-20 object-cover rounded border border-gray-200 shrink-0" />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-md px-2.5 py-1 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" />
              {uploading ? "Uploading…" : "Change"}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="flex items-center gap-1.5 text-xs border border-red-200 rounded-md px-2.5 py-1 text-red-600 hover:bg-red-50 transition-colors"
            >
              <X className="w-3 h-3" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 justify-center border border-dashed border-gray-300 rounded-lg py-4 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {uploading ? "Uploading…" : "Upload image"}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
