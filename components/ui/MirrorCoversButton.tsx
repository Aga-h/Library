"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type State =
  | { kind: "idle" }
  | { kind: "running"; done: number; remaining: number }
  | { kind: "done"; total: number }
  | { kind: "error"; message: string };

export default function MirrorCoversButton({ apiPath }: { apiPath: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleMirror() {
    setState({ kind: "running", done: 0, remaining: 0 });
    let totalMirrored = 0;

    while (true) {
      try {
        const res = await fetch(apiPath, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setState({ kind: "error", message: data.error ?? "Mirroring failed" });
          return;
        }
        totalMirrored += data.mirrored as number;
        if (data.remaining === 0) break;
        if ((data.mirrored as number) === 0) {
          setState({ kind: "error", message: "No covers uploaded — check Supabase bucket and keys" });
          return;
        }
        setState({ kind: "running", done: totalMirrored, remaining: data.remaining as number });
      } catch {
        setState({ kind: "error", message: "Network error — try again" });
        return;
      }
    }

    setState({ kind: "done", total: totalMirrored });
    router.refresh();
    setTimeout(() => setState({ kind: "idle" }), 6000);
  }

  if (state.kind === "done") {
    return (
      <span className="text-sm text-green-700 font-medium px-3 py-2">
        {state.total} cover{state.total !== 1 ? "s" : ""} mirrored
      </span>
    );
  }

  if (state.kind === "error") {
    return (
      <span className="text-sm text-red-600 font-medium px-3 py-2">
        {state.message}
      </span>
    );
  }

  if (state.kind === "running") {
    return (
      <span className="text-sm text-gray-500 font-medium px-3 py-2">
        Mirroring… {state.done} done, {state.remaining} left
      </span>
    );
  }

  return (
    <button
      onClick={handleMirror}
      className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
    >
      Mirror Covers
    </button>
  );
}
