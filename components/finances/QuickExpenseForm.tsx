"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CloudOff, Loader2, RefreshCw } from "lucide-react";
import {
  enqueue,
  listQueue,
  syncQueue,
  type QueuedExpense,
  type SyncResult,
} from "@/lib/expense-queue";

// Full list, ordered so the ones used most often sit under the thumb.
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "FOOD", label: "Food" },
  { value: "TRANSPORTATION", label: "Transport" },
  { value: "SUBSCRIPTIONS", label: "Subs" },
  { value: "ENTERTAINMENT", label: "Fun" },
  { value: "SELF_CARE", label: "Self Care" },
  { value: "CLOTHING", label: "Clothing" },
  { value: "BOOKS", label: "Books" },
  { value: "EDUCATION", label: "Education" },
  { value: "CASH", label: "Cash" },
  { value: "OTHER", label: "Other" },
];

const CATEGORY_LABEL = new Map(CATEGORY_OPTIONS.map((c) => [c.value, c.label]));

function fmt(n: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
}

interface Logged {
  amount: number;
  category: string;
  pending: boolean;
}

export default function QuickExpenseForm() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("FOOD");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);

  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<QueuedExpense[]>([]);
  const [session, setSession] = useState<Logged[]>([]);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "saved"; offline: boolean } | { kind: "auth" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [syncing, setSyncing] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);

  const refreshPending = useCallback(async () => {
    try {
      setPending(await listQueue());
    } catch {
      /* IndexedDB unavailable (private mode) — the form still works online. */
    }
  }, []);

  const applySync = useCallback((result: SyncResult) => {
    if (result.authRequired) setStatus({ kind: "auth" });
    if (result.rejected.length > 0) {
      setStatus({ kind: "error", message: result.rejected[0].reason });
    }
    if (result.synced > 0) {
      setSession((prev) => prev.map((s) => ({ ...s, pending: false })));
    }
  }, []);

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      applySync(await syncQueue());
    } catch {
      /* ignore — nothing is lost, it stays queued */
    } finally {
      setSyncing(false);
      await refreshPending();
    }
  }, [applySync, refreshPending]);

  // iOS has no Background Sync, so flush on every foreground signal instead.
  useEffect(() => {
    // Deferred to a microtask so the first paint isn't blocked and so no state is
    // set synchronously during the effect.
    const boot = async () => {
      await Promise.resolve();
      await runSync();
    };
    void boot();

    const onOnline = () => void runSync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void runSync();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [runSync]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setStatus({ kind: "error", message: "Enter an amount greater than zero" });
      return;
    }

    setSaving(true);
    setStatus({ kind: "idle" });

    // Month comes from the device, not the server — the deploy region is Tokyo, so a
    // server-derived month would be wrong near a month boundary.
    const now = new Date();

    try {
      await enqueue({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        category,
        amount: value,
        ...(description.trim() ? { description: description.trim() } : {}),
      });

      setSession((prev) => [{ amount: value, category, pending: true }, ...prev].slice(0, 8));
      setAmount("");
      setDescription("");
      setShowDescription(false);

      const result = await syncQueue();
      applySync(result);
      const stillQueued = result.remaining > 0;
      if (!result.authRequired && result.rejected.length === 0) {
        setStatus({ kind: "saved", offline: stillQueued });
      }
      if (!stillQueued) {
        setSession((prev) => prev.map((s) => ({ ...s, pending: false })));
      }
    } catch {
      setStatus({ kind: "error", message: "Could not save. Try again." });
    } finally {
      setSaving(false);
      await refreshPending();
      amountRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label htmlFor="amount" className="sr-only">Amount</label>
          <div className="flex items-baseline gap-2 border-b-2 border-gray-200 focus-within:border-emerald-500 transition-colors">
            <span className="text-3xl font-bold text-gray-300">₺</span>
            <input
              id="amount"
              ref={amountRef}
              type="text"
              inputMode="decimal"
              autoFocus
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent py-2 text-4xl font-bold text-gray-900 tabular-nums placeholder:text-gray-200 focus:outline-none"
            />
          </div>
        </div>

        <fieldset>
          <legend className="sr-only">Category</legend>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORY_OPTIONS.map((c) => {
              const active = category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  aria-pressed={active}
                  className={`rounded-xl px-2 py-3 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 active:bg-gray-100"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {showDescription ? (
          <div>
            <label htmlFor="description" className="sr-only">Description</label>
            <input
              id="description"
              type="text"
              placeholder="What was it for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDescription(true)}
            className="self-start text-sm font-medium text-gray-400 active:text-gray-600"
          >
            + Add a note
          </button>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-4 text-base font-semibold text-white disabled:opacity-50 active:bg-gray-700 transition-colors"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {saving ? "Saving…" : "Save expense"}
        </button>
      </form>

      <StatusLine
        status={status}
        pendingCount={pending.length}
        syncing={syncing}
        onRetry={() => void runSync()}
      />

      {session.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <p className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Logged just now
          </p>
          <ul>
            {session.map((s, i) => (
              <li
                key={i}
                className="flex items-center justify-between px-4 py-2.5 text-sm border-b border-gray-50 last:border-0"
              >
                <span className="text-gray-600">{CATEGORY_LABEL.get(s.category) ?? s.category}</span>
                <span className="flex items-center gap-2">
                  {s.pending && <CloudOff className="h-3.5 w-3.5 text-amber-500" aria-label="Waiting to upload" />}
                  <span className="font-semibold text-gray-900 tabular-nums">{fmt(s.amount)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusLine({
  status,
  pendingCount,
  syncing,
  onRetry,
}: {
  status: { kind: string; offline?: boolean; message?: string };
  pendingCount: number;
  syncing: boolean;
  onRetry: () => void;
}) {
  if (status.kind === "auth") {
    return (
      <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        Your session expired. <a href="/login?from=/finances/log" className="font-semibold underline">Sign in</a> —
        nothing you logged has been lost.
      </p>
    );
  }

  if (status.kind === "error" && status.message) {
    return (
      <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        {status.message}
      </p>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        <span className="flex items-center gap-2">
          <CloudOff className="h-4 w-4 flex-shrink-0" />
          {pendingCount} saved on this device — will upload when you&apos;re back online.
        </span>
        <button
          onClick={onRetry}
          disabled={syncing}
          aria-label="Retry upload now"
          className="flex-shrink-0 rounded-lg border border-amber-300 p-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        </button>
      </div>
    );
  }

  if (status.kind === "saved") {
    return (
      <p className="flex items-center gap-2 px-1 text-sm font-medium text-emerald-600">
        <Check className="h-4 w-4" /> Saved
      </p>
    );
  }

  return <p className="px-1 text-sm text-gray-400">Everything is synced.</p>;
}
