"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; created: number; updated: number }
  | { kind: "error"; message: string };

export default function SteamSyncButton() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleSync() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/games/steam-sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Sync failed" });
        return;
      }
      setState({ kind: "success", created: data.created, updated: data.updated });
      router.refresh();
      setTimeout(() => setState({ kind: "idle" }), 4000);
    } catch {
      setState({ kind: "error", message: "Network error — try again" });
    }
  }

  if (state.kind === "success") {
    return (
      <span className="text-sm text-green-700 font-medium px-3 py-2">
        Added {state.created} · Updated {state.updated}
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

  return (
    <button
      onClick={handleSync}
      disabled={state.kind === "loading"}
      className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.37l3.04-6.28c-.77-.35-1.3-1.13-1.3-2.03 0-1.24 1-2.25 2.25-2.25.43 0 .83.12 1.17.33l2.77-5.72A6.01 6.01 0 0 0 12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c.57 0 1.12-.08 1.64-.22l-1.57 3.24C17.83 20.46 21 16.6 21 12 21 5.37 15.63 0 12 0zm.75 15.75a3.75 3.75 0 1 1 0-7.5 3.75 3.75 0 0 1 0 7.5z" />
      </svg>
      {state.kind === "loading" ? "Syncing…" : "Sync Steam"}
    </button>
  );
}
