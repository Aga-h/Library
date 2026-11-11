"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, Search, Send, X } from "lucide-react";
import { inputCls } from "@/components/ui/form";
import { APP_TIME_ZONE } from "@/lib/dates";
import {
  KIND_LABEL, KIND_SOURCE, MAX_DAYS, MIN_DAYS, NOTE_MAX, UNKNOWN_DAYS, SHARE_KINDS, SHARE_NOT_READY, allowanceDays, elapsedShare, sourceLink, timeLeft,
  type ShareKind, type ShareMedia,
} from "@/lib/media-share";
import type { ExchangeState, ShareHit, ShareItem } from "@/lib/media-share-service";

interface Props {
  /** Null until migration 042 has run. */
  state: ExchangeState | null;
  /** The server's clock at render, so the first paint of the timers matches. */
  now: string;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: APP_TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: APP_TIME_ZONE, day: "numeric", month: "short" });
}

/** The ticking clock: once a minute is enough for a deadline counted in days. */
function useNow(initial: string): Date {
  const [now, setNow] = useState(() => new Date(initial));
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Cover({ media, size }: { media: ShareMedia; size: "sm" | "lg" }) {
  const cls = size === "lg" ? "w-20 sm:w-24" : "w-12";
  if (!media.image) return <div className={`${cls} aspect-[2/3] flex-shrink-0 bg-gray-100 rounded`} aria-hidden />;
  return (
    // Catalogue covers, straight from TMDB, MyAnimeList or Google Books, as elsewhere in the library.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.image} alt="" referrerPolicy="no-referrer" loading="lazy"
      className={`${cls} aspect-[2/3] flex-shrink-0 object-cover rounded bg-gray-100`} />
  );
}

function MediaLines({ media }: { media: ShareMedia }) {
  const link = sourceLink(media.kind, media.sourceId);
  const meta = [KIND_LABEL[media.kind], media.year, media.lengthLabel].filter(Boolean).join(" · ");
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="font-semibold text-gray-900 break-words">{media.title}</p>
      {media.altTitle && <p className="text-sm text-gray-500 break-words">{media.altTitle}</p>}
      <p className="text-xs text-gray-500">{meta}</p>
      {(media.creator || media.facts.length > 0) && (
        <p className="text-xs text-gray-500 break-words">{[media.creator, ...media.facts].filter(Boolean).join(" · ")}</p>
      )}
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2">
          {KIND_SOURCE[media.kind]} <ExternalLink className="w-3 h-3" aria-hidden />
        </a>
      )}
    </div>
  );
}

function Timer({ item, now, whose }: { item: ShareItem; now: Date; whose: string }) {
  const left = timeLeft(new Date(item.dueAt), now);
  const share = elapsedShare(new Date(item.sentAt), new Date(item.dueAt), now);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`text-2xl font-bold ${left.late ? "text-orange-600" : "text-gray-900"}`}>{left.text}</span>
        <span className="text-xs text-gray-500">{whose} {when(item.dueAt)}</span>
      </div>
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden" role="presentation">
        <div className={`h-full ${left.late ? "bg-orange-400" : "bg-sky-400"}`} style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm break-words">{error}</p>;
}

// ─── What came from the friend ───────────────────────────────────────────────

function Received({ item, friend, now }: { item: ShareItem | null; friend: string; now: Date }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(id: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/exchange/${id}/finish`, { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "Couldn't save that — try again.");
    if (!data.item?.notifiedAt) setError(`Saved, but ${friend}'s site didn't answer — try telling them again.`);
    router.refresh();
  }

  if (!item || (item.finishedAt && item.notifiedAt)) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-gray-700">Nothing from {friend} right now.</p>
        {item && <p className="text-xs text-gray-500">You finished {item.media.title} on {day(item.finishedAt!)}.</p>}
      </div>
    );
  }

  if (item.finishedAt) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          You finished {item.media.title}, but {friend}&apos;s site hasn&apos;t heard yet — so they can&apos;t send the next one.
        </p>
        <ErrorLine error={error} />
        <button type="button" onClick={() => finish(item.id)} disabled={busy}
          className="inline-flex items-center gap-2 border border-gray-200 bg-white text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Tell them again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Cover media={item.media} size="lg" />
        <div className="min-w-0 space-y-2">
          <MediaLines media={item.media} />
          {item.note && <p className="text-sm text-gray-700 break-words">&ldquo;{item.note}&rdquo;</p>}
          <p className="text-xs text-gray-500">Sent {when(item.sentAt)}</p>
        </div>
      </div>
      <Timer item={item} now={now} whose="due" />
      <ErrorLine error={error} />
      <button type="button" onClick={() => finish(item.id)} disabled={busy}
        className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Finished it
      </button>
    </div>
  );
}

// ─── Sending to the friend ───────────────────────────────────────────────────

function SendForm({ friend, onClose }: { friend: string; onClose: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<ShareKind>("movie");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShareHit[] | null>(null);
  const [picked, setPicked] = useState<ShareHit | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"search" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const least = kind === "anime" || kind === "manga" ? 3 : 2;

  function pickKind(k: ShareKind) {
    setKind(k);
    setResults(null);
    setPicked(null);
    setError(null);
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < least) return;
    setBusy("search");
    setError(null);
    setPicked(null);
    const res = await fetch(`/api/exchange/search?${new URLSearchParams({ kind, q: query.trim() })}`).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(null);
    if (!res?.ok) {
      setResults(null);
      return setError(data?.error ?? "Search failed — try again.");
    }
    setResults(data.results);
  }

  async function send() {
    if (!picked) return;
    setBusy("send");
    setError(null);
    const res = await fetch("/api/exchange/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, sourceId: picked.sourceId, note: note.trim() || null }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(null);
    if (!res?.ok) return setError(data?.error ?? "Couldn't send it — try again.");
    onClose();
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
      <div className="flex flex-wrap gap-1.5 flex-1" role="group" aria-label="What to send">
        {SHARE_KINDS.map((k) => (
          <button key={k} type="button" onClick={() => pickKind(k)} aria-pressed={k === kind}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              k === kind ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
        <button type="button" onClick={onClose} aria-label="Close without sending"
          className="p-1.5 text-gray-400 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={runSearch} className="flex gap-2">
        <label htmlFor="exchange-query" className="sr-only">Search {KIND_SOURCE[kind]}</label>
        <input id="exchange-query" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${KIND_SOURCE[kind]}`} className={`${inputCls} flex-1`} />
        <button type="submit" disabled={busy !== null || query.trim().length < least}
          className="flex items-center gap-2 border border-gray-200 bg-white text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
          {busy === "search" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="max-sm:sr-only">Search</span>
        </button>
      </form>

      <ErrorLine error={error} />

      {picked ? (
        <div className="space-y-3">
          <div className="flex gap-3 items-start">
            <Cover media={hitMedia(kind, picked)} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 break-words">{picked.title}</p>
              <p className="text-xs text-gray-500">{[KIND_LABEL[kind], picked.year, picked.meta].filter(Boolean).join(" · ")}</p>
              <button type="button" onClick={() => setPicked(null)}
                className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 mt-1">Pick another</button>
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-700">A note with it (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} rows={2}
              className={inputCls} placeholder="Why they should watch it" />
          </label>
          <button type="button" onClick={send} disabled={busy !== null}
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {busy === "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send to {friend}
          </button>
        </div>
      ) : results && (
        results.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing found on {KIND_SOURCE[kind]}.</p>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-[22rem] overflow-y-auto">
            {results.map((r) => (
              <li key={r.sourceId}>
                <button type="button" onClick={() => setPicked(r)}
                  className="w-full flex items-center gap-3 px-1 py-2 text-left hover:bg-gray-50">
                  <Cover media={hitMedia(kind, r)} size="sm" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 break-words">{r.title}</span>
                    {r.altTitle && <span className="block text-xs text-gray-500 break-words">{r.altTitle}</span>}
                    <span className="block text-xs text-gray-500">{[r.year, r.meta].filter(Boolean).join(" · ")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

/** A search hit as a cover needs it. */
function hitMedia(kind: ShareKind, hit: ShareHit): ShareMedia {
  return {
    kind, sourceId: hit.sourceId, title: hit.title, altTitle: hit.altTitle, year: hit.year, image: hit.image,
    creator: null, facts: [], lengthMinutes: null, lengthLabel: hit.meta,
  };
}

function Sent({ item, friend, now }: { item: ShareItem | null; friend: string; now: Date }) {
  const [open, setOpen] = useState(false);

  if (item && !item.finishedAt) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Cover media={item.media} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 break-words">{item.media.title}</p>
            <p className="text-xs text-gray-500">
              {[KIND_LABEL[item.media.kind], item.media.lengthLabel].filter(Boolean).join(" · ")} · sent {day(item.sentAt)}
            </p>
          </div>
        </div>
        <Timer item={item} now={now} whose={`${friend} has until`} />
        <p className="text-xs text-gray-500">You can send the next one once they mark it finished.</p>
      </div>
    );
  }

  if (open) return <SendForm friend={friend} onClose={() => setOpen(false)} />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">
        {item
          ? `${friend} finished ${item.media.title} on ${day(item.finishedAt!)}.`
          : `Nothing sent to ${friend} yet.`}
      </p>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
        <Send className="w-4 h-4" /> Send something
      </button>
      <p className="text-xs text-gray-500">
        A movie, show, anime, manga or book. {friend} gets about a day per hour of it — a two-hour film is
        {" "}{allowanceDays(120)} days — at least {MIN_DAYS}, at most {MAX_DAYS}, and {UNKNOWN_DAYS} when its length isn&apos;t known.
      </p>
    </div>
  );
}

// ─── The portal block ────────────────────────────────────────────────────────

export default function MediaExchange({ state, now: initialNow }: Props) {
  const now = useNow(initialNow);

  if (!state) {
    return <div className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-sm text-gray-700">{SHARE_NOT_READY}</p></div>;
  }
  if (!state.friend) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-1">
        <p className="text-sm text-gray-700">Connect a friend&apos;s site to send each other movies, shows, anime, manga and books.</p>
        <p className="text-xs text-gray-500">
          {state.setupIssue ??
            "Set FRIEND_SITE_URL, FRIEND_NAME and EXCHANGE_TOKEN (the same 32+ characters on both sites) in Vercel, then redeploy."}
        </p>
      </div>
    );
  }

  const friend = state.friend.name;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">from {friend}</p>
        <Received item={state.received} friend={friend} now={now} />
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">to {friend}</p>
        <Sent item={state.sent} friend={friend} now={now} />
      </div>
    </div>
  );
}
