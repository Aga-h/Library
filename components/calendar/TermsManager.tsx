"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { inputCls } from "@/components/ui/form";

interface Term { id: string; name: string | null; startDate: string; endDate: string }
interface DayOff { id: string; date: string; reason: string | null }

export default function TermsManager({ terms, daysOff }: { terms: Term[]; daysOff: DayOff[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState({ name: "", startDate: "", endDate: "" });
  const [off, setOff] = useState({ date: "", reason: "" });

  async function send(url: string, init: RequestInit) {
    setError(null);
    const res = await fetch(url, init);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong");
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  const post = (url: string, body: unknown) =>
    send(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  return (
    <div className="flex flex-col gap-10">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">School terms</h2>
        <p className="text-sm text-gray-500 mb-4">
          Weekdays inside a term are school days. Everything else is a holiday — including every
          weekend, always.
        </p>
        <div className="flex flex-col gap-2 mb-4">
          {terms.length === 0 && <p className="text-sm text-gray-400">No terms yet, so every day is a holiday.</p>}
          {terms.map((t) => (
            <div key={t.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5">
              <span className="text-sm text-gray-900">
                {t.name && <span className="font-semibold">{t.name} · </span>}
                <span className="tabular-nums">{t.startDate}</span> → <span className="tabular-nums">{t.endDate}</span>
              </span>
              <button aria-label="Delete term" onClick={() => send(`/api/calendar/terms/${t.id}`, { method: "DELETE" })}
                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await post("/api/calendar/terms", { name: term.name || undefined, startDate: term.startDate, endDate: term.endDate })) {
              setTerm({ name: "", startDate: "", endDate: "" });
            }
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="text" value={term.name} onChange={(e) => setTerm({ ...term, name: e.target.value })}
            placeholder="Name (optional)" aria-label="Term name" className={`${inputCls} w-44`} />
          <input type="date" required value={term.startDate} onChange={(e) => setTerm({ ...term, startDate: e.target.value })}
            aria-label="Term start" className={`${inputCls} w-44`} />
          <input type="date" required value={term.endDate} onChange={(e) => setTerm({ ...term, endDate: e.target.value })}
            aria-label="Term end" className={`${inputCls} w-44`} />
          <button type="submit" className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add term
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Days off</h2>
        <p className="text-sm text-gray-500 mb-4">
          A single date inside a term that is a holiday anyway — a public holiday, say.
        </p>
        <div className="flex flex-col gap-2 mb-4">
          {daysOff.length === 0 && <p className="text-sm text-gray-400">None marked.</p>}
          {daysOff.map((d) => (
            <div key={d.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5">
              <span className="text-sm text-gray-900">
                <span className="tabular-nums">{d.date}</span>
                {d.reason && <span className="text-gray-500"> · {d.reason}</span>}
              </span>
              <button aria-label="Delete day off" onClick={() => send(`/api/calendar/days-off/${d.id}`, { method: "DELETE" })}
                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await post("/api/calendar/days-off", { date: off.date, reason: off.reason || undefined })) {
              setOff({ date: "", reason: "" });
            }
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="date" required value={off.date} onChange={(e) => setOff({ ...off, date: e.target.value })}
            aria-label="Day off date" className={`${inputCls} w-44`} />
          <input type="text" value={off.reason} onChange={(e) => setOff({ ...off, reason: e.target.value })}
            placeholder="Reason (optional)" aria-label="Reason" className={`${inputCls} w-56`} />
          <button type="submit" className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add day off
          </button>
        </form>
      </section>
    </div>
  );
}
