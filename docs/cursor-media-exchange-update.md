# Media exchange — update 1 (11 Nov 2026): a queue, and three times the time

> **Arkadaşına not (Türkçe):** Medya takası özelliğini zaten kurduysan bu dosyayı Cursor'a ver ve
> "apply this update to the existing media exchange" de. Sadece yenilikler var. Yeni tablo, yeni
> env ya da SQL yok. Değişenler:
> - Aynı anda istediğin kadar gönderebiliyorsun ve gelenler sıraya giriyor. Bu güncelleme sende
>   kurulana kadar Aga'nın sana gönderdiği **ikinci** medya reddedilir.
> - Her medyanın kendi sayacı var ve hepsi aynı anda işliyor. En son gönderilen en üstte görünüyor.
> - Süreler 3 katına çıktı.

## Prompt for Cursor

This project already has the media exchange with Aga's site (portal panels "from / to {friend}",
`POST /api/exchange/inbox`, `POST /api/exchange/inbox/{id}/finished`, a `MediaShare` table).
Apply these three changes in this project's own style. **No schema change and no new env vars.**

### 1. Items queue: drop the one-at-a-time rule

- **Inbox** (`POST /api/exchange/inbox`): remove the check that answers 409 when an earlier received
  item is still open. Earlier items being open is **not** a reason to refuse any more. Keep the
  rest as it is:
  - same `id` already stored as received → the same `201 {"dueAt"}`
  - same `id` stored as sent → 409
  - bad body → 400, bad token → 401
- **New guard instead:** if **50 or more** received items are unfinished, answer
  `409 {"error": "50 are already waiting here — finish some first."}`.
- **Sending:** remove "the last item sent isn't finished yet → refuse". The guard applies here too:
  refuse with 409 only when 50 sent items are unfinished.

### 2. Deadline ×3 (computed by the receiving site when an item arrives)

```
days = clamp(ceil(lengthMinutes / 60) * 3, 6, 180)      // 21 when lengthMinutes is null/0/unknown
dueAt = arrival time + days × 24h
```

That is three times the old rule (`clamp(ceil(min/60), 2, 60)`, 7 unknown) at every length. Examples:

| Item | Days |
|---|---|
| 2 h film | 6 |
| 2 h 5 min film | 9 |
| 28 × 24 min anime | 36 |
| 541-page book | 42 |

Items already stored keep the deadline they arrived with; don't recompute them.
Update the explanatory text under the Send button to match: "3 days per hour of each — a two-hour
film is 6 days — at least 6, at most 180, and 21 when its length isn't known."

### 3. The portal lists everything, newest first, every timer running at once

**"from {friend}"**
- Show **every** received item that is unfinished, **plus** any that are finished but whose
  "finished" call to the friend's site hasn't gone through (`notifiedAt` is null). Order them by
  `sentAt`, **newest first**, up to 50.
- Above the list, when more than one is open: "N waiting — the newest first."
- Each item keeps its card:
  - cover: bigger for the first (newest), small for the rest
  - title, details and the catalogue link
  - the note and "Sent …"
  - **its own live countdown and progress bar**: one shared clock ticking every 30 s drives all of
    them
  - **its own "Finished it" button**, with its own loading and error state, so finishing one
    doesn't touch the others
- A finished-but-not-told item shows "You finished X, but {friend}'s site hasn't heard yet." and
  its own "Tell them again" button.
- Nothing left: "Nothing from {friend} right now."
- Under the list: "Last finished: X, <date>". This is the newest received item with `notifiedAt`
  set, by `finishedAt`.

**"to {friend}"**
- **"Send something" is always shown**, never disabled. Under it: "A movie, show, anime, manga or
  book — as many as you like; they queue." plus the deadline text above.
- After a successful send, close the picker and refresh the lists.
- Then **every** sent item that is unfinished, `sentAt` newest first, up to 50. Each shows:
  - small cover, title, and "kind · length · sent <date>"
  - its own countdown ("{friend} has until …")
- Nothing waiting: "Nothing waiting with {friend}."
- Under the list: "{friend} finished X (<date>), Y (<date>), Z (<date>)". These are the last
  three sent items they finished, by `finishedAt`, newest first.

Separate items in a list with a thin divider.

### Done when

- [ ] three different items POSTed to `/api/exchange/inbox` in a row are each answered **201**, and
      all three show on the portal newest first, each with its own countdown
- [ ] "Finished it" on the middle one removes only that one, and the friend's site gets the
      `/finished` call for that `id`
- [ ] sending three things in a row from here works, and all three are listed under "to {friend}"
- [ ] a 2-hour film arrives with `dueAt` 6 days after arrival, and one with no length with 21 days
- [ ] still fine at phone width (≈ 390 px), no sideways scrolling

---

## Reference: the diff on Aga's site (Next.js / Prisma / Tailwind) — for behaviour only

### `lib/media-share.ts`

```diff
@@ -2,8 +2,8 @@
 // for it, and the checks on what the other site sends. Pure — the network and the database are in
 // lib/media-share-service.ts, and the wire format is written up in docs/media-exchange.md.
 //
-// One item is open each way at a time: you send something, and can send the next once they mark
-// it finished. The receiver's deadline is worked out on the receiving site, from the item's length.
+// Any number can be sent; they queue on the receiver's side, each with its own deadline running from
+// when it arrived. The deadline is worked out on the receiving site, from the item's length.
 
 import { z } from "zod";
 import type { TmdbDetails } from "@/lib/tmdb";
@@ -69,18 +69,22 @@ export const VOLUME_MINUTES = 45;
 export const PAGE_MINUTES = 1.5;
 
 /**
- * Days the receiver gets: an hour of it a day, rounded up, so a two-hour film is two days. Never
- * under two (a short film still needs an evening that suits), never over 60 (a 1,000-episode run
- * isn't a deadline anyone keeps), and a week when the length isn't known.
+ * Days the receiver gets: three days per hour of it, rounded up by the hour, so a two-hour film is
+ * six days (asked for 2026-11-11: three times the first rule, an hour a day). Never under 6 (a
+ * short film still needs evenings that suit), never over 180 (a 1,000-episode run isn't a
+ * deadline anyone keeps), and three weeks when the length isn't known.
  */
-export const MIN_DAYS = 2;
-export const MAX_DAYS = 60;
-export const UNKNOWN_DAYS = 7;
-export const MINUTES_PER_DAY = 60;
+export const DAYS_PER_HOUR = 3;
+export const MIN_DAYS = 6;
+export const MAX_DAYS = 180;
+export const UNKNOWN_DAYS = 21;
+
+/** More open than this each way is refused — a guard against a runaway sender, not a rule. */
+export const MAX_OPEN = 50;
 
 export function allowanceDays(lengthMinutes: number | null): number {
   if (lengthMinutes === null || !Number.isFinite(lengthMinutes) || lengthMinutes <= 0) return UNKNOWN_DAYS;
-  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.ceil(lengthMinutes / MINUTES_PER_DAY)));
+  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.ceil(lengthMinutes / 60) * DAYS_PER_HOUR));
 }
 
 /** When the receiver should be done by, counted from when it arrived. */
```

### `lib/media-share-service.ts`

```diff
@@ -9,7 +9,7 @@ import { MalError, entryDetails, mangaEntry, searchAnime, searchManga } from "@/
 import { BookCatalogError } from "@/lib/openlibrary";
 import { catalogDetails, searchCatalog } from "@/lib/book-catalog-service";
 import {
-  dueFrom, fromAnime, fromBook, fromFilm, fromManga, fromShow, friendBaseUrl, isSourceId, shareMediaSchema,
+  MAX_OPEN, dueFrom, fromAnime, fromBook, fromFilm, fromManga, fromShow, friendBaseUrl, isSourceId, shareMediaSchema,
   type ShareKind, type ShareMedia,
 } from "@/lib/media-share";
 
@@ -206,30 +206,45 @@ function toItem(row: Row): ShareItem | null {
   };
 }
 
-async function latest(direction: "sent" | "received"): Promise<ShareItem | null> {
-  const row = await db.mediaShare.findFirst({ where: { direction }, orderBy: { sentAt: "desc" } });
-  return row ? toItem(row) : null;
-}
+const items = (rows: Row[]) => rows.map(toItem).filter((i): i is ShareItem => i !== null);
 
-async function openOne(direction: "sent" | "received") {
-  return db.mediaShare.findFirst({ where: { direction, finishedAt: null }, orderBy: { sentAt: "desc" } });
+async function openCount(direction: "sent" | "received"): Promise<number> {
+  return db.mediaShare.count({ where: { direction, finishedAt: null } });
 }
 
 export interface ExchangeState {
   friend: { name: string } | null;
   /** Why `friend` is null: what to fix in the environment. */
   setupIssue: string | null;
-  /** The newest thing sent to the friend, and the newest from them. */
-  sent: ShareItem | null;
-  received: ShareItem | null;
+  /** Sent to the friend and not finished yet, newest first. */
+  sent: ShareItem[];
+  /** The last few the friend finished, most recently finished first. */
+  sentDone: ShareItem[];
+  /** From the friend: not finished yet, or finished but their site not told yet. Newest first. */
+  received: ShareItem[];
+  /** The last one finished here and told to their site. */
+  receivedDone: ShareItem | null;
 }
 
 /** What the portal shows. Null until migration 042 has run. */
 export async function exchangeState(): Promise<ExchangeState | null> {
   const friend = friendConfig();
+  const newest = { sentAt: "desc" } as const;
   try {
-    const [sent, received] = await Promise.all([latest("sent"), latest("received")]);
-    return { friend: friend ? { name: friend.name } : null, setupIssue: friendSetupIssue(), sent, received };
+    const [sent, sentDone, received, receivedDone] = await Promise.all([
+      db.mediaShare.findMany({ where: { direction: "sent", finishedAt: null }, orderBy: newest, take: MAX_OPEN }),
+      db.mediaShare.findMany({ where: { direction: "sent", finishedAt: { not: null } }, orderBy: { finishedAt: "desc" }, take: 3 }),
+      db.mediaShare.findMany({ where: { direction: "received", notifiedAt: null }, orderBy: newest, take: MAX_OPEN }),
+      db.mediaShare.findFirst({ where: { direction: "received", notifiedAt: { not: null } }, orderBy: { finishedAt: "desc" } }),
+    ]);
+    return {
+      friend: friend ? { name: friend.name } : null,
+      setupIssue: friendSetupIssue(),
+      sent: items(sent),
+      sentDone: items(sentDone),
+      received: items(received),
+      receivedDone: receivedDone ? toItem(receivedDone) : null,
+    };
   } catch (e) {
     if (isMissingTable(e)) return null;
     throw e;
@@ -244,8 +259,9 @@ export async function sendToFriend(kind: ShareKind, sourceId: string, note: stri
   const friend = friendConfig();
   if (!friend) throw new ShareError("Set FRIEND_SITE_URL and EXCHANGE_TOKEN first.", 503);
 
-  const open = await openOne("sent");
-  if (open) throw new ShareError(`${friend.name} hasn't finished ${open.title} yet.`, 409);
+  if ((await openCount("sent")) >= MAX_OPEN) {
+    throw new ShareError(`${MAX_OPEN} are already waiting for ${friend.name} — let them catch up first.`, 409);
+  }
 
   const media = await mediaDetails(kind, sourceId);
   const id = crypto.randomUUID();
@@ -278,8 +294,8 @@ export type InboxOutcome =
   | { ok: false; status: number; error: string };
 
 /**
- * Something sent from the friend's site. The same id again is answered the same way (a retry);
- * something new while their last is still open here is refused.
+ * Something sent from the friend's site, queued behind whatever is still open here. The same id
+ * again is answered the same way (a retry). Past MAX_OPEN open items, more are refused.
  */
 export async function receive(body: {
   id: string; sentAt: string; note: string | null; media: ShareMedia;
@@ -290,8 +306,9 @@ export async function receive(body: {
       ? { ok: true, dueAt: existing.dueAt.toISOString() }
       : { ok: false, status: 409, error: "That id is already in use here." };
   }
-  const open = await openOne("received");
-  if (open) return { ok: false, status: 409, error: `Still on ${open.title} — it can be sent once that's finished.` };
+  if ((await openCount("received")) >= MAX_OPEN) {
+    return { ok: false, status: 409, error: `${MAX_OPEN} are already waiting here — finish some first.` };
+  }
 
   // The deadline counts from when it arrived here, not the sender's clock.
   const now = new Date();
```

### `components/exchange/MediaExchange.tsx`

```diff
@@ -6,7 +6,7 @@ import { Check, ExternalLink, Loader2, Search, Send, X } from "lucide-react";
 import { inputCls } from "@/components/ui/form";
 import { APP_TIME_ZONE } from "@/lib/dates";
 import {
-  KIND_LABEL, KIND_SOURCE, MAX_DAYS, MIN_DAYS, NOTE_MAX, UNKNOWN_DAYS, SHARE_KINDS, SHARE_NOT_READY, allowanceDays, elapsedShare, sourceLink, timeLeft,
+  DAYS_PER_HOUR, KIND_LABEL, KIND_SOURCE, MAX_DAYS, MIN_DAYS, NOTE_MAX, UNKNOWN_DAYS, SHARE_KINDS, SHARE_NOT_READY, allowanceDays, elapsedShare, sourceLink, timeLeft,
   type ShareKind, type ShareMedia,
 } from "@/lib/media-share";
 import type { ExchangeState, ShareHit, ShareItem } from "@/lib/media-share-service";
@@ -95,15 +95,17 @@ function ErrorLine({ error }: { error: string | null }) {
 
 // ─── What came from the friend ───────────────────────────────────────────────
 
-function Received({ item, friend, now }: { item: ShareItem | null; friend: string; now: Date }) {
+/** One thing from the friend: its card, timer and Finished button — or, finished but their site not
+ *  told yet, the retry. Each keeps its own busy state, so finishing one leaves the others alone. */
+function ReceivedItem({ item, friend, now, first }: { item: ShareItem; friend: string; now: Date; first: boolean }) {
   const router = useRouter();
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);
 
-  async function finish(id: string) {
+  async function finish() {
     setBusy(true);
     setError(null);
-    const res = await fetch(`/api/exchange/${id}/finish`, { method: "POST" }).catch(() => null);
+    const res = await fetch(`/api/exchange/${item.id}/finish`, { method: "POST" }).catch(() => null);
     const data = await res?.json().catch(() => ({}));
     setBusy(false);
     if (!res?.ok) return setError(data?.error ?? "Couldn't save that — try again.");
@@ -111,34 +113,25 @@ function Received({ item, friend, now }: { item: ShareItem | null; friend: strin
     router.refresh();
   }
 
-  if (!item || (item.finishedAt && item.notifiedAt)) {
-    return (
-      <div className="space-y-1">
-        <p className="text-sm text-gray-700">Nothing from {friend} right now.</p>
-        {item && <p className="text-xs text-gray-500">You finished {item.media.title} on {day(item.finishedAt!)}.</p>}
-      </div>
-    );
-  }
-
   if (item.finishedAt) {
     return (
-      <div className="space-y-3">
+      <li className="py-4 first:pt-0 last:pb-0 space-y-3">
         <p className="text-sm text-gray-700">
-          You finished {item.media.title}, but {friend}&apos;s site hasn&apos;t heard yet — so they can&apos;t send the next one.
+          You finished {item.media.title}, but {friend}&apos;s site hasn&apos;t heard yet.
         </p>
         <ErrorLine error={error} />
-        <button type="button" onClick={() => finish(item.id)} disabled={busy}
+        <button type="button" onClick={finish} disabled={busy}
           className="inline-flex items-center gap-2 border border-gray-200 bg-white text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
           {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Tell them again
         </button>
-      </div>
+      </li>
     );
   }
 
   return (
-    <div className="space-y-4">
+    <li className="py-4 first:pt-0 last:pb-0 space-y-3">
       <div className="flex gap-4">
-        <Cover media={item.media} size="lg" />
+        <Cover media={item.media} size={first ? "lg" : "sm"} />
         <div className="min-w-0 space-y-2">
           <MediaLines media={item.media} />
           {item.note && <p className="text-sm text-gray-700 break-words">&ldquo;{item.note}&rdquo;</p>}
@@ -147,10 +140,32 @@ function Received({ item, friend, now }: { item: ShareItem | null; friend: strin
       </div>
       <Timer item={item} now={now} whose="due" />
       <ErrorLine error={error} />
-      <button type="button" onClick={() => finish(item.id)} disabled={busy}
+      <button type="button" onClick={finish} disabled={busy}
         className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
         {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Finished it
       </button>
+    </li>
+  );
+}
+
+/** Everything from the friend still open, newest first, every timer running at once. */
+function Received({ items, done, friend, now }: {
+  items: ShareItem[]; done: ShareItem | null; friend: string; now: Date;
+}) {
+  const open = items.filter((i) => !i.finishedAt).length;
+  return (
+    <div className="space-y-3">
+      {items.length === 0 ? (
+        <p className="text-sm text-gray-700">Nothing from {friend} right now.</p>
+      ) : (
+        open > 1 && <p className="text-xs text-gray-500">{open} waiting — the newest first.</p>
+      )}
+      {items.length > 0 && (
+        <ul className="divide-y divide-gray-100">
+          {items.map((item, i) => <ReceivedItem key={item.id} item={item} friend={friend} now={now} first={i === 0} />)}
+        </ul>
+      )}
+      {done && <p className="text-xs text-gray-500">Last finished: {done.media.title}, {day(done.finishedAt!)}.</p>}
     </div>
   );
 }
@@ -293,44 +308,54 @@ function hitMedia(kind: ShareKind, hit: ShareHit): ShareMedia {
   };
 }
 
-function Sent({ item, friend, now }: { item: ShareItem | null; friend: string; now: Date }) {
+/** What's waiting with the friend, newest first, with their timers; sending more is always open. */
+function Sent({ items, done, friend, now }: { items: ShareItem[]; done: ShareItem[]; friend: string; now: Date }) {
   const [open, setOpen] = useState(false);
 
-  if (item && !item.finishedAt) {
-    return (
-      <div className="space-y-4">
-        <div className="flex gap-3">
-          <Cover media={item.media} size="sm" />
-          <div className="min-w-0">
-            <p className="font-semibold text-gray-900 break-words">{item.media.title}</p>
-            <p className="text-xs text-gray-500">
-              {[KIND_LABEL[item.media.kind], item.media.lengthLabel].filter(Boolean).join(" · ")} · sent {day(item.sentAt)}
-            </p>
-          </div>
+  return (
+    <div className="space-y-4">
+      {open ? (
+        <SendForm friend={friend} onClose={() => setOpen(false)} />
+      ) : (
+        <div className="space-y-2">
+          <button type="button" onClick={() => setOpen(true)}
+            className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
+            <Send className="w-4 h-4" /> Send something
+          </button>
+          <p className="text-xs text-gray-500">
+            A movie, show, anime, manga or book — as many as you like; they queue. {friend} gets {DAYS_PER_HOUR} days
+            per hour of each — a two-hour film is {allowanceDays(120)} days — at least {MIN_DAYS}, at most {MAX_DAYS},
+            and {UNKNOWN_DAYS} when its length isn&apos;t known.
+          </p>
         </div>
-        <Timer item={item} now={now} whose={`${friend} has until`} />
-        <p className="text-xs text-gray-500">You can send the next one once they mark it finished.</p>
-      </div>
-    );
-  }
+      )}
 
-  if (open) return <SendForm friend={friend} onClose={() => setOpen(false)} />;
+      {items.length === 0 ? (
+        <p className="text-sm text-gray-700">Nothing waiting with {friend}.</p>
+      ) : (
+        <ul className="divide-y divide-gray-100">
+          {items.map((item) => (
+            <li key={item.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
+              <div className="flex gap-3">
+                <Cover media={item.media} size="sm" />
+                <div className="min-w-0">
+                  <p className="font-semibold text-gray-900 break-words">{item.media.title}</p>
+                  <p className="text-xs text-gray-500">
+                    {[KIND_LABEL[item.media.kind], item.media.lengthLabel].filter(Boolean).join(" · ")} · sent {day(item.sentAt)}
+                  </p>
+                </div>
+              </div>
+              <Timer item={item} now={now} whose={`${friend} has until`} />
+            </li>
+          ))}
+        </ul>
+      )}
 
-  return (
-    <div className="space-y-3">
-      <p className="text-sm text-gray-700">
-        {item
-          ? `${friend} finished ${item.media.title} on ${day(item.finishedAt!)}.`
-          : `Nothing sent to ${friend} yet.`}
-      </p>
-      <button type="button" onClick={() => setOpen(true)}
-        className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
-        <Send className="w-4 h-4" /> Send something
-      </button>
-      <p className="text-xs text-gray-500">
-        A movie, show, anime, manga or book. {friend} gets about a day per hour of it — a two-hour film is
-        {" "}{allowanceDays(120)} days — at least {MIN_DAYS}, at most {MAX_DAYS}, and {UNKNOWN_DAYS} when its length isn&apos;t known.
-      </p>
+      {done.length > 0 && (
+        <p className="text-xs text-gray-500">
+          {friend} finished {done.map((d) => `${d.media.title} (${day(d.finishedAt!)})`).join(", ")}.
+        </p>
+      )}
     </div>
   );
 }
@@ -360,11 +385,11 @@ export default function MediaExchange({ state, now: initialNow }: Props) {
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
         <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">from {friend}</p>
-        <Received item={state.received} friend={friend} now={now} />
+        <Received items={state.received} done={state.receivedDone} friend={friend} now={now} />
       </div>
       <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
         <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">to {friend}</p>
-        <Sent item={state.sent} friend={friend} now={now} />
+        <Sent items={state.sent} done={state.sentDone} friend={friend} now={now} />
       </div>
     </div>
   );
```

