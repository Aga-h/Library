"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteGameButton({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/games/${gameId}`, { method: "DELETE" });
    if (res.ok) { router.push("/library/games");  }
    else { setLoading(false); setConfirming(false); }
  }

  if (confirming) {
    return (
      <div className="flex gap-2">
        <button onClick={handleDelete} disabled={loading} className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">{loading ? "Deleting…" : "Confirm"}</button>
        <button onClick={() => setConfirming(false)} className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className="flex items-center gap-1.5 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors">
      <Trash2 className="w-3.5 h-3.5" /> Delete
    </button>
  );
}
