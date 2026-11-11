# Media exchange — handoff for Cursor

> **Arkadaşına not (Türkçe):** Bu dosyanın tamamını Cursor'a ver (Agent modunda, "bu dosyadaki
> özelliği benim projeme ekle" de). Cursor senin sitene, Aga'nın sitesiyle karşılıklı film/dizi/
> anime/manga/kitap gönderme özelliğini ekleyecek. Bitince yapman gerekenler en altta
> "What the owner does by hand" bölümünde. En önemlisi: `EXCHANGE_TOKEN` iki sitede **birebir aynı**
> olmalı. Onu Aga ile WhatsApp vb. özelden paylaşın, kodun içine ya da Cursor chat'ine yazmayın.

---

## Prompt for Cursor

You are adding a feature to this project: **a media exchange with a friend's site** (the friend's
site is already built; it is a Next.js app, and its code for this feature is copied at the bottom
of this file as a reference). The two sites send each other a movie, TV show, anime, manga or book.

Build it **in this project's own stack and conventions** (framework, database/ORM, auth, styling,
component library). Do not copy the reference code blindly — it is there so you can see the exact
behaviour and the wire format. **The wire format below is a contract and must match exactly**, or
the two sites cannot talk.

### What the user sees (on the home / portal page, near the top)

1. **"from {FRIEND_NAME}"** — the item the friend sent, if one is open: cover image, title, alt
   title, kind · year · length label, creator · facts, a link to its catalogue page, the friend's
   note, when it was sent, and a **live countdown** to its deadline ("1d 4h left", under a day
   "3h 20m left", past it "2d 1h late" in a warning colour) with a thin progress bar. A
   **"Finished it"** button marks it finished and tells the friend's site.
   - If finishing was saved but the friend's site couldn't be reached: say so and show a
     **"Tell them again"** button (it re-calls the same finish action).
   - If nothing is open: "Nothing from {friend} right now." (+ the last one finished and when.)
2. **"to {FRIEND_NAME}"** — while the last item sent is not finished by the friend: its title and
   the friend's countdown ("{friend} has until …"), and "You can send the next one once they mark it
   finished." Otherwise: "{friend} finished X on <date>" (or "Nothing sent yet") and a
   **"Send something"** button that opens an inline picker:
   - type chips: Movie, TV, Anime, Manga, Book
   - a search box for that type's catalogue: **TMDB** (movie, tv), **MyAnimeList** (anime, manga —
     needs ≥ 3 letters), **Google Books** (book)
   - a result list (thumbnail, title, alt title, year, short meta) → pick one
   - optional note (max 500 chars) → **"Send to {friend}"**
3. If the database table isn't there yet, or the env vars aren't set, show a one-line explanation
   instead of the panels.

**One item is open each way at a time.** You can't send a new one until the friend finished the
last one you sent, and the server refuses (409) an incoming item while the previous one from the
friend is still open here.

### The deadline rule (computed by the RECEIVING site when the item arrives)

`days = clamp(ceil(lengthMinutes / 60), 2, 60)`; `7` if the length is unknown (null/0).
`dueAt = arrival time + days × 24h`. (A 2 h film → 2 days, 28 × 24 min anime → 12 days.)

How `lengthMinutes` is computed by the SENDER from the catalogue:

| kind | lengthMinutes | lengthLabel |
|---|---|---|
| movie | TMDB `runtime` (null if 0) | "2h 5m" |
| tv | Σ over numbered seasons (not season 0): episode count × that season's average episode runtime, else the show's typical runtime (default 45) | "3 seasons · 20 episodes" |
| anime | MAL `num_episodes` × (`average_episode_duration` seconds / 60, rounded) | "28 episodes × 24m" (1 episode: "2h 4m") |
| manga | MAL `num_chapters` × 5, else `num_volumes` × 45 | "42 volumes · 380 chapters" |
| book | Google Books `pageCount` × 1.5, rounded | "541 pages" |

### Environment variables (on this site)

| Variable | Value |
|---|---|
| `FRIEND_SITE_URL` | the friend's site origin, e.g. `https://www.sadwankel.site` (https only; http allowed only for localhost) |
| `FRIEND_NAME` | what to call the friend in the UI, e.g. `Aga` |
| `EXCHANGE_TOKEN` | 32+ random characters, **identical on both sites**. Fail closed: unset or shorter than 32 → refuse everything |
| `TMDB_API_KEY`, `MAL_CLIENT_ID`, `GOOGLE_BOOKS_API_KEY` | catalogue keys for searching (only needed to *send*; receiving needs none) |

### The wire protocol (MUST match exactly)

All calls are `POST`, JSON, over HTTPS, with header `Authorization: Bearer <EXCHANGE_TOKEN>`.
**These two paths, and only these, must accept the token instead of a logged-in session** — make
the site's auth middleware let exactly these through when the bearer token matches (compare in
constant time, e.g. SHA-256 both sides then XOR-compare), and re-check the token inside the handler.
The token must not unlock any other path.

#### 1. `POST /api/exchange/inbox` — the friend delivers an item to us

Request body:
```json
{
  "id": "3f1c3a5e-8d0f-4b8a-9d0e-0b5d6f1f2a3b",
  "sentAt": "2026-11-11T10:00:00.000Z",
  "note": "watch this",
  "media": {
    "kind": "movie",
    "sourceId": "129",
    "title": "Spirited Away",
    "altTitle": null,
    "year": 2001,
    "image": "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    "creator": "Hayao Miyazaki",
    "facts": ["Studio Ghibli"],
    "lengthMinutes": 125,
    "lengthLabel": "2h 5m"
  }
}
```

Validation (reject with `400 {"error": "...", "issues": [...]}` if it doesn't fit):
- `id`: UUID (generated by the sender; both sites store the item under this same id)
- `sentAt`: ISO-8601 datetime with offset/Z
- `note`: string ≤ 500 chars, or null
- `media.kind`: one of `movie`, `tv`, `anime`, `manga`, `book`
- `media.sourceId`: for movie/tv/anime/manga a positive integer as a string (`^[1-9]\d{0,9}$`,
  TMDB or MyAnimeList id); for book a Google Books volume id (`^[A-Za-z0-9_-]{4,40}$`)
- `media.title` 1–300 chars; `altTitle` / `creator` 1–300 chars or null; `facts` ≤ 6 strings of
  1–120 chars; `year` integer 1000–3000 or null; `lengthMinutes` positive integer ≤ 1,000,000 or
  null; `lengthLabel` 1–120 chars or null
- `media.image`: string ≤ 1000 or null. **Keep it only if** it is `https:` on `image.tmdb.org`,
  `cdn.myanimelist.net`, or a Google Books cover host (`books.google.com`,
  `books.googleusercontent.com`); otherwise store null (don't reject the item).

Behaviour:
- Same `id` already stored as received → `201 {"dueAt": <the stored dueAt>}` (idempotent retry).
- Same `id` stored as something we *sent* → `409 {"error": "That id is already in use here."}`
- Another received item still open (not finished) → `409 {"error": "Still on <title> — it can be sent once that's finished."}`
- Otherwise store it (direction `received`; `sentAt` = their value unless invalid or in the future,
  then now; `dueAt` = now + allowance) → **`201 {"dueAt": "<ISO>"}`**.
- Bad/missing token → `401 {"error": "Unauthorized"}`.

#### 2. `POST /api/exchange/inbox/{id}/finished` — the friend says they finished what WE sent

`{id}` is a lowercase UUID. Body: `{ "finishedAt": "2026-11-12T20:15:00.000Z" }`.

- No item with that id that **we sent** → `404 {"error": "..."}`
- Otherwise set `finishedAt` if not already set (first date wins; if it's in the future or before
  `sentAt`, use now) → `200 {"ok": true}`.

#### What this site calls on the friend's site

- **Sending** (the user pressed "Send to {friend}"): the server (never the browser) reads the
  item's details fresh from the catalogue by `kind` + `sourceId`, builds `media`, generates a UUID,
  **stores the row first** (direction `sent`, `dueAt` = our own estimate), then
  `POST {FRIEND_SITE_URL}/api/exchange/inbox` with the body above (10 s timeout, do **not** follow
  redirects, so the token never goes elsewhere). On a 2xx, overwrite `dueAt` with the `dueAt` in
  their answer. On any failure, **delete the row** and show the error ("Couldn't reach {friend}'s
  site — try again in a minute.", "…refused the token — EXCHANGE_TOKEN must be the same on both
  sites." on 401, or their `error` text).
- **Finishing** (the user pressed "Finished it" on a received item): set `finishedAt` (if not set),
  then `POST {FRIEND_SITE_URL}/api/exchange/inbox/{id}/finished` with `{finishedAt}`. On 2xx — or a
  404, meaning they have no such item — set `notifiedAt`. Otherwise leave `notifiedAt` null and the
  UI shows "Tell them again".

### Storage (one table)

```sql
CREATE TABLE IF NOT EXISTS "MediaShare" (
  "id"         TEXT NOT NULL PRIMARY KEY,      -- the sender's UUID
  "direction"  TEXT NOT NULL,                  -- 'sent' | 'received'
  "kind"       TEXT NOT NULL,                  -- movie | tv | anime | manga | book
  "title"      TEXT NOT NULL,
  "media"      JSONB NOT NULL,                 -- the whole media object above
  "note"       TEXT,
  "sentAt"     TIMESTAMP(3) NOT NULL,
  "dueAt"      TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  "notifiedAt" TIMESTAMP(3),                   -- received items: when the friend's site was told
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MediaShare_direction_sentAt_idx" ON "MediaShare"("direction", "sentAt");
-- On Supabase: ALTER TABLE "MediaShare" ENABLE ROW LEVEL SECURITY;
```
Adapt it to this project's ORM/migrations. The portal reads the newest `sent` row and the newest
`received` row (by `sentAt`).

### Endpoints for this site's own UI (session-protected, names are up to you)

- search a catalogue: `kind` + `q` → `[{sourceId, title, altTitle, year, image, meta}]`
- send: `{kind, sourceId, note}` → the stored item (409 if the last sent is still open)
- finish: `{id}` of a received item → the item with `finishedAt` / `notifiedAt`

### Done when

- [ ] the table exists; the two friend endpoints behave exactly as above (test with curl: no token →
      401, wrong token → 401, token on any other path → still 401, bad body → 400, good body →
      201 + `dueAt`, same body again → same 201, a second different id while open → 409)
- [ ] sending from here shows up on the friend's portal with its timer, and the "Send something"
      button stays blocked until the friend presses "Finished it"
- [ ] an item from the friend shows here with the countdown; "Finished it" unblocks them
- [ ] the friend's site being down: sending fails cleanly with no row left behind; finishing is
      saved and "Tell them again" appears
- [ ] works on a phone width (≈ 390 px) without sideways scrolling
- [ ] the owner's to-do list below is written somewhere they will see it

### What the owner does by hand

1. Run the table's migration on the production database.
2. Set `FRIEND_SITE_URL` = Aga's site address (Aga will tell you which one is live; e.g.
   `https://www.sadwankel.site`), `FRIEND_NAME` = `Aga`, and `EXCHANGE_TOKEN` = the shared secret
   agreed privately with Aga (generate once with `openssl rand -hex 32`; **both sites the same
   value**; never commit it or paste it into a chat with an AI). Redeploy.
3. Send your own site's address to Aga for their `FRIEND_SITE_URL`.
4. Have the catalogue keys you want to search with: `TMDB_API_KEY` (themoviedb.org → Settings →
   API), `MAL_CLIENT_ID` (myanimelist.net/apiconfig), `GOOGLE_BOOKS_API_KEY` (Google Cloud → Books
   API).

---

## Reference implementation (the friend's site — Next.js 16, Prisma, Zod, Tailwind)

For behaviour only. Adapt names, imports and styling to this project. `@/lib/tmdb`, `@/lib/mal`,
`@/lib/google-books`, `@/lib/*-service`, `@/lib/db`, `withErrors`, `readJson`, `isMissingTable` are
that project's own helpers (catalogue clients, Prisma client, error wrappers); write the equivalents
here.

### `lib/media-share.ts`

```ts
// Sending media to a friend's site and back: what an item carries, how long the receiver gets
// for it, and the checks on what the other site sends. Pure — the network and the database are in
// lib/media-share-service.ts, and the wire format is written up in docs/media-exchange.md.
//
// One item is open each way at a time: you send something, and can send the next once they mark
// it finished. The receiver's deadline is worked out on the receiving site, from the item's length.

import { z } from "zod";
import type { TmdbDetails } from "@/lib/tmdb";
import type { TmdbShowDetails } from "@/lib/tmdb-tv";
import type { MalEntry } from "@/lib/mal";
import type { MalManga } from "@/lib/mal-manga";
import type { CatalogBook } from "@/lib/openlibrary";
import { isTmdbImage } from "@/lib/tmdb";
import { isMalImage } from "@/lib/mal";
import { isGoogleBooksImage } from "@/lib/google-books";

export const SHARE_KINDS = ["movie", "tv", "anime", "manga", "book"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export const KIND_LABEL: Record<ShareKind, string> = {
  movie: "Movie",
  tv: "TV",
  anime: "Anime",
  manga: "Manga",
  book: "Book",
};

/** Which catalogue each kind is searched in — shown beside the search box. */
export const KIND_SOURCE: Record<ShareKind, string> = {
  movie: "TMDB",
  tv: "TMDB",
  anime: "MyAnimeList",
  manga: "MyAnimeList",
  book: "Google Books",
};

export const NOTE_MAX = 500;

export const SHARE_NOT_READY = "The media exchange starts once 042-media-shares.sql has run in Supabase.";

/** An item as both sites hold it: everything shown on the card. */
export interface ShareMedia {
  kind: ShareKind;
  /** The catalogue's id: TMDB or MyAnimeList's number, or the Google Books volume id. */
  sourceId: string;
  title: string;
  /** The English title, when the main one is romaji. */
  altTitle: string | null;
  year: number | null;
  image: string | null;
  /** Director, creator, studio or author. */
  creator: string | null;
  /** Short lines under the title: "Studio Ghibli", "HBO", "Penguin". */
  facts: string[];
  /** How long it takes to get through, in minutes; null when the catalogue doesn't say. */
  lengthMinutes: number | null;
  /** The length as the catalogue counts it: "2h 5m", "3 seasons · 30 episodes", "320 pages". */
  lengthLabel: string | null;
}

// ─── How long things take ────────────────────────────────────────────────────

/** A manga chapter, read. */
export const CHAPTER_MINUTES = 5;
/** A volume, when only volumes are counted (about nine chapters). */
export const VOLUME_MINUTES = 45;
/** A page of a book: about 40 pages an hour. */
export const PAGE_MINUTES = 1.5;

/**
 * Days the receiver gets: an hour of it a day, rounded up, so a two-hour film is two days. Never
 * under two (a short film still needs an evening that suits), never over 60 (a 1,000-episode run
 * isn't a deadline anyone keeps), and a week when the length isn't known.
 */
export const MIN_DAYS = 2;
export const MAX_DAYS = 60;
export const UNKNOWN_DAYS = 7;
export const MINUTES_PER_DAY = 60;

export function allowanceDays(lengthMinutes: number | null): number {
  if (lengthMinutes === null || !Number.isFinite(lengthMinutes) || lengthMinutes <= 0) return UNKNOWN_DAYS;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.ceil(lengthMinutes / MINUTES_PER_DAY)));
}

/** When the receiver should be done by, counted from when it arrived. */
export function dueFrom(received: Date, lengthMinutes: number | null): Date {
  return new Date(received.getTime() + allowanceDays(lengthMinutes) * 24 * 60 * 60 * 1000);
}

/** "2h 5m", "45m", "3h". */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/**
 * What's left, for the timer: "1d 4h left", "3h 20m left", "5m left", or "2d 1h late". Under a
 * day it counts minutes, since that's when they matter.
 */
export function timeLeft(due: Date, now: Date): { late: boolean; text: string } {
  const diff = due.getTime() - now.getTime();
  const late = diff < 0;
  const total = Math.floor(Math.abs(diff) / 60_000);
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const span = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return { late, text: late ? `${span} late` : `${span} left` };
}

/** How much of the allowance is used, 0–1, for the bar under the timer. */
export function elapsedShare(sent: Date, due: Date, now: Date): number {
  const span = due.getTime() - sent.getTime();
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - sent.getTime()) / span));
}

// ─── From each catalogue ─────────────────────────────────────────────────────

function positive(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function fromFilm(d: TmdbDetails): ShareMedia {
  return {
    kind: "movie",
    sourceId: String(d.id),
    title: d.title,
    altTitle: null,
    year: d.year,
    image: d.poster,
    creator: d.director,
    facts: d.studio ? [d.studio] : [],
    lengthMinutes: positive(d.runtime) ? d.runtime : null,
    lengthLabel: positive(d.runtime) ? formatMinutes(d.runtime) : null,
  };
}

/** The whole show: every numbered season's episodes, at the season's runtime or the show's. */
export function fromShow(d: TmdbShowDetails): ShareMedia {
  let episodes = 0;
  let minutes = 0;
  for (const s of d.seasons) {
    const count = s.episodeCount ?? 0;
    episodes += count;
    minutes += count * (s.runtime ?? d.runtime);
  }
  const label = episodes > 0
    ? `${plural(d.seasons.length, "season")} · ${plural(episodes, "episode")}`
    : null;
  return {
    kind: "tv",
    sourceId: String(d.id),
    title: d.name,
    altTitle: null,
    year: d.year,
    image: d.poster,
    creator: d.creator,
    facts: d.network ? [d.network] : [],
    lengthMinutes: minutes > 0 ? minutes : null,
    lengthLabel: label,
  };
}

const ANIME_TYPES: Record<string, string> = {
  tv: "TV", movie: "Movie", ova: "OVA", ona: "ONA", special: "Special", music: "Music", tv_special: "TV special",
};

export function fromAnime(e: MalEntry): ShareMedia {
  const eps = positive(e.episodes) ? e.episodes : null;
  const each = positive(e.duration) ? e.duration : null;
  const minutes = eps !== null && each !== null ? eps * each : null;
  let label: string | null = null;
  if (eps === 1 && each !== null) label = formatMinutes(each);
  else if (eps !== null) label = each !== null ? `${plural(eps, "episode")} × ${formatMinutes(each)}` : plural(eps, "episode");
  const kind = ANIME_TYPES[e.mediaType];
  return {
    kind: "anime",
    sourceId: String(e.id),
    title: e.title,
    altTitle: e.titleEn && e.titleEn !== e.title ? e.titleEn : null,
    year: e.year,
    image: e.poster,
    creator: e.studio,
    facts: [kind, e.airing === "airing" ? "Still airing" : null].filter((f): f is string => !!f),
    lengthMinutes: minutes,
    lengthLabel: label,
  };
}

export function fromManga(m: MalManga): ShareMedia {
  const chapters = positive(m.chapters) ? m.chapters : null;
  const volumes = positive(m.volumes) ? m.volumes : null;
  const minutes = chapters !== null ? chapters * CHAPTER_MINUTES : volumes !== null ? volumes * VOLUME_MINUTES : null;
  const parts = [volumes !== null ? plural(volumes, "volume") : null, chapters !== null ? plural(chapters, "chapter") : null]
    .filter((p): p is string => !!p);
  const people = [...new Set([...m.writers, ...m.artists])];
  return {
    kind: "manga",
    sourceId: String(m.id),
    title: m.title,
    altTitle: m.titleEn && m.titleEn !== m.title ? m.titleEn : null,
    year: m.year,
    image: m.cover,
    creator: people.length ? people.join(", ") : null,
    facts: m.publishing === "currently_publishing" ? ["Still publishing"] : [],
    lengthMinutes: minutes,
    lengthLabel: parts.length ? parts.join(" · ") : null,
  };
}

export function fromBook(b: CatalogBook): ShareMedia {
  const pages = positive(b.pages) ? b.pages : null;
  return {
    kind: "book",
    sourceId: b.googleBooksId ?? b.id,
    title: b.title,
    altTitle: null,
    year: b.year,
    image: b.cover,
    creator: b.author || null,
    facts: b.publisher ? [b.publisher] : [],
    lengthMinutes: pages !== null ? Math.round(pages * PAGE_MINUTES) : null,
    lengthLabel: pages !== null ? plural(pages, "page") : null,
  };
}

// ─── Links and ids ───────────────────────────────────────────────────────────

const NUMERIC_ID = /^[1-9]\d{0,9}$/;
const BOOK_ID = /^[A-Za-z0-9_-]{4,40}$/;

/** Whether a catalogue id is the shape its kind's catalogue uses. */
export function isSourceId(kind: ShareKind, id: string): boolean {
  return kind === "book" ? BOOK_ID.test(id) : NUMERIC_ID.test(id);
}

/** The item's page on its catalogue. Built here, never taken from the other site. */
export function sourceLink(kind: ShareKind, id: string): string | null {
  if (!isSourceId(kind, id)) return null;
  switch (kind) {
    case "movie": return `https://www.themoviedb.org/movie/${id}`;
    case "tv": return `https://www.themoviedb.org/tv/${id}`;
    case "anime": return `https://myanimelist.net/anime/${id}`;
    case "manga": return `https://myanimelist.net/manga/${id}`;
    case "book": return `https://books.google.com/books?id=${encodeURIComponent(id)}`;
  }
}

/** Only https covers from the three catalogues' own image hosts are shown. */
export function isShareImage(src: string): boolean {
  try {
    if (new URL(src).protocol !== "https:") return false;
  } catch {
    return false;
  }
  return isTmdbImage(src) || isMalImage(src) || isGoogleBooksImage(src);
}

// ─── What the other site sends ───────────────────────────────────────────────

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const shareMediaSchema = z
  .object({
    kind: z.enum(SHARE_KINDS),
    sourceId: z.string().max(40),
    title: shortText(300),
    altTitle: shortText(300).nullable(),
    year: z.number().int().min(1000).max(3000).nullable(),
    image: z.string().max(1000).nullable(),
    creator: shortText(300).nullable(),
    facts: z.array(shortText(120)).max(6),
    lengthMinutes: z.number().int().positive().max(1_000_000).nullable(),
    lengthLabel: shortText(120).nullable(),
  })
  .refine((m) => isSourceId(m.kind, m.sourceId), { message: "Bad catalogue id", path: ["sourceId"] })
  // A cover from anywhere else is dropped rather than refusing the item.
  .transform((m) => ({ ...m, image: m.image && isShareImage(m.image) ? m.image : null }));

/** `POST /api/exchange/inbox` — something sent from the friend's site. */
export const inboxSchema = z.object({
  id: z.uuid(),
  sentAt: z.iso.datetime({ offset: true }),
  note: z.string().trim().max(NOTE_MAX).nullable(),
  media: shareMediaSchema,
});
export type InboxBody = z.infer<typeof inboxSchema>;

/** `POST /api/exchange/send` — from the portal's send sheet. */
export const sendSchema = z.object({
  kind: z.enum(SHARE_KINDS),
  sourceId: z.string().trim().max(40),
  note: z.string().trim().max(NOTE_MAX).optional().nullable(),
});

/** The friend's site's address: https, or http only for a site on this machine (testing). */
export function friendBaseUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
    if (u.username || u.password) return null;
    return u.origin;
  } catch {
    return null;
  }
}
```

### `lib/media-share-service.ts`

```ts
// The media exchange's server side: searching the catalogues, reading an item's details, the
// rows in MediaShare, and talking to the friend's site. Rules are in lib/media-share.ts.

import { db } from "@/lib/db";
import { todayKey } from "@/lib/dates";
import { isMissingTable } from "@/lib/prisma-errors";
import { TmdbError, filmDetails, search, searchTv, showDetails } from "@/lib/tmdb-service";
import { MalError, entryDetails, mangaEntry, searchAnime, searchManga } from "@/lib/mal-service";
import { BookCatalogError } from "@/lib/openlibrary";
import { catalogDetails, searchCatalog } from "@/lib/book-catalog-service";
import {
  dueFrom, fromAnime, fromBook, fromFilm, fromManga, fromShow, friendBaseUrl, isSourceId, shareMediaSchema,
  type ShareKind, type ShareMedia,
} from "@/lib/media-share";

/** A catalogue said no: its own message and status, passed on to the portal. */
export class ShareError extends Error {
  /** What the friend's site answered, when it was their site that said no. */
  constructor(message: string, readonly status: number, readonly remoteStatus: number | null = null) {
    super(message);
  }
}

function catalogueError(e: unknown): ShareError | null {
  if (e instanceof TmdbError || e instanceof MalError || e instanceof BookCatalogError) {
    return new ShareError(e.message, e.status);
  }
  return null;
}

// ─── Catalogues ──────────────────────────────────────────────────────────────

/** A search result: enough to pick the right one. */
export interface ShareHit {
  sourceId: string;
  title: string;
  altTitle: string | null;
  year: number | null;
  image: string | null;
  /** "24 episodes", "Brandon Sanderson", "manga · 41 volumes". */
  meta: string | null;
}

export async function searchKind(kind: ShareKind, q: string): Promise<ShareHit[]> {
  try {
    switch (kind) {
      case "movie":
        return (await search(q)).films.map((f) => ({
          sourceId: String(f.id), title: f.title, altTitle: null, year: f.year, image: f.poster, meta: null,
        }));
      case "tv":
        return (await searchTv(q)).shows.map((s) => ({
          sourceId: String(s.id), title: s.name, altTitle: null, year: s.year, image: s.poster, meta: null,
        }));
      case "anime":
        return (await searchAnime(q)).map((e) => {
          const m = fromAnime(e);
          return { sourceId: m.sourceId, title: m.title, altTitle: m.altTitle, year: m.year, image: m.image, meta: m.lengthLabel };
        });
      case "manga":
        return (await searchManga(q)).map((x) => {
          const m = fromManga(x);
          return { sourceId: m.sourceId, title: m.title, altTitle: m.altTitle, year: m.year, image: m.image, meta: m.lengthLabel };
        });
      case "book":
        return (await searchCatalog(q)).works
          .filter((w) => w.googleBooksId)
          .map((w) => {
            const m = fromBook(w);
            return {
              sourceId: m.sourceId, title: m.title, altTitle: null, year: m.year, image: w.coverThumb ?? m.image,
              meta: [m.creator, m.lengthLabel].filter(Boolean).join(" · ") || null,
            };
          });
    }
  } catch (e) {
    throw catalogueError(e) ?? e;
  }
}

/** Everything sent with an item, read fresh from its catalogue rather than taken from the browser. */
export async function mediaDetails(kind: ShareKind, sourceId: string): Promise<ShareMedia> {
  if (!isSourceId(kind, sourceId)) throw new ShareError("That isn't an id from the catalogue.", 400);
  const missing = new ShareError("The catalogue doesn't have that any more.", 404);
  try {
    switch (kind) {
      case "movie": {
        const [d] = (await filmDetails([Number(sourceId)])).details;
        if (!d) throw missing;
        return fromFilm(d);
      }
      case "tv": {
        const [d] = (await showDetails([Number(sourceId)], todayKey())).details;
        if (!d) throw missing;
        return fromShow(d);
      }
      case "anime": {
        const [e] = (await entryDetails([Number(sourceId)])).entries;
        if (!e) throw missing;
        return fromAnime(e);
      }
      case "manga":
        return fromManga(await mangaEntry(Number(sourceId)));
      case "book": {
        const [w] = (await catalogDetails([{ googleBooksId: sourceId }])).works;
        if (!w) throw missing;
        return fromBook(w);
      }
    }
  } catch (e) {
    throw catalogueError(e) ?? e;
  }
}

// ─── The friend's site ───────────────────────────────────────────────────────

export interface FriendConfig {
  url: string;
  name: string;
  token: string;
}

/** Null until FRIEND_SITE_URL and EXCHANGE_TOKEN (32+ characters) are both set. */
export function friendConfig(): FriendConfig | null {
  const url = friendBaseUrl(process.env.FRIEND_SITE_URL);
  const token = process.env.EXCHANGE_TOKEN?.trim();
  if (!url || !token || token.length < 32) return null;
  const name = process.env.FRIEND_NAME?.trim().slice(0, 40) || new URL(url).hostname.replace(/^www\./, "");
  return { url, name, token };
}

const FRIEND_TIMEOUT_MS = 10_000;

/** POST to the friend's site. Throws ShareError with what to tell the person when it fails. */
async function callFriend(friend: FriendConfig, path: string, body: unknown): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${friend.url}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${friend.token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FRIEND_TIMEOUT_MS),
      // Never follow a redirect with the token on it.
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    throw new ShareError(`Couldn't reach ${friend.name}'s site — try again in a minute.`, 502);
  }
  const answer = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status === 401) {
    throw new ShareError(`${friend.name}'s site refused the token — EXCHANGE_TOKEN must be the same on both sites.`, 502);
  }
  if (!res.ok || !answer) {
    const said = typeof answer?.error === "string" ? `: ${answer.error.slice(0, 200)}` : ".";
    throw new ShareError(`${friend.name}'s site answered ${res.status}${said}`, res.status === 409 ? 409 : 502, res.status);
  }
  return answer;
}

// ─── Rows ────────────────────────────────────────────────────────────────────

export interface ShareItem {
  id: string;
  direction: "sent" | "received";
  media: ShareMedia;
  note: string | null;
  sentAt: string;
  dueAt: string;
  finishedAt: string | null;
  notifiedAt: string | null;
}

type Row = {
  id: string; direction: string; media: unknown; note: string | null;
  sentAt: Date; dueAt: Date; finishedAt: Date | null; notifiedAt: Date | null;
};

function toItem(row: Row): ShareItem | null {
  const media = shareMediaSchema.safeParse(row.media);
  if (!media.success) return null;
  return {
    id: row.id,
    direction: row.direction === "sent" ? "sent" : "received",
    media: media.data,
    note: row.note,
    sentAt: row.sentAt.toISOString(),
    dueAt: row.dueAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    notifiedAt: row.notifiedAt?.toISOString() ?? null,
  };
}

async function latest(direction: "sent" | "received"): Promise<ShareItem | null> {
  const row = await db.mediaShare.findFirst({ where: { direction }, orderBy: { sentAt: "desc" } });
  return row ? toItem(row) : null;
}

async function openOne(direction: "sent" | "received") {
  return db.mediaShare.findFirst({ where: { direction, finishedAt: null }, orderBy: { sentAt: "desc" } });
}

export interface ExchangeState {
  friend: { name: string } | null;
  /** The newest thing sent to the friend, and the newest from them. */
  sent: ShareItem | null;
  received: ShareItem | null;
}

/** What the portal shows. Null until migration 042 has run. */
export async function exchangeState(): Promise<ExchangeState | null> {
  const friend = friendConfig();
  try {
    const [sent, received] = await Promise.all([latest("sent"), latest("received")]);
    return { friend: friend ? { name: friend.name } : null, sent, received };
  } catch (e) {
    if (isMissingTable(e)) return null;
    throw e;
  }
}

/**
 * Sends an item to the friend's site. The row is written first and removed if the friend's site
 * doesn't take it, so a sent item never exists on one side only for long.
 */
export async function sendToFriend(kind: ShareKind, sourceId: string, note: string | null): Promise<ShareItem> {
  const friend = friendConfig();
  if (!friend) throw new ShareError("Set FRIEND_SITE_URL and EXCHANGE_TOKEN first.", 503);

  const open = await openOne("sent");
  if (open) throw new ShareError(`${friend.name} hasn't finished ${open.title} yet.`, 409);

  const media = await mediaDetails(kind, sourceId);
  const id = crypto.randomUUID();
  const sentAt = new Date();
  await db.mediaShare.create({
    data: {
      id, direction: "sent", kind, title: media.title, media: { ...media }, note,
      sentAt, dueAt: dueFrom(sentAt, media.lengthMinutes),
    },
  });

  let answer: Record<string, unknown>;
  try {
    answer = await callFriend(friend, "/api/exchange/inbox", { id, sentAt: sentAt.toISOString(), note, media });
  } catch (e) {
    await db.mediaShare.delete({ where: { id } }).catch(() => {});
    throw e;
  }

  // Their deadline, as their site worked it out.
  const due = typeof answer.dueAt === "string" ? new Date(answer.dueAt) : null;
  const row = due && !Number.isNaN(due.getTime())
    ? await db.mediaShare.update({ where: { id }, data: { dueAt: due } })
    : await db.mediaShare.findUniqueOrThrow({ where: { id } });
  return toItem(row)!;
}

export type InboxOutcome =
  | { ok: true; dueAt: string }
  | { ok: false; status: number; error: string };

/**
 * Something sent from the friend's site. The same id again is answered the same way (a retry);
 * something new while their last is still open here is refused.
 */
export async function receive(body: {
  id: string; sentAt: string; note: string | null; media: ShareMedia;
}): Promise<InboxOutcome> {
  const existing = await db.mediaShare.findUnique({ where: { id: body.id } });
  if (existing) {
    return existing.direction === "received"
      ? { ok: true, dueAt: existing.dueAt.toISOString() }
      : { ok: false, status: 409, error: "That id is already in use here." };
  }
  const open = await openOne("received");
  if (open) return { ok: false, status: 409, error: `Still on ${open.title} — it can be sent once that's finished.` };

  // The deadline counts from when it arrived here, not the sender's clock.
  const now = new Date();
  const sentAt = new Date(body.sentAt);
  const row = await db.mediaShare.create({
    data: {
      id: body.id, direction: "received", kind: body.media.kind, title: body.media.title, media: { ...body.media },
      note: body.note || null, sentAt: Number.isNaN(sentAt.getTime()) || sentAt > now ? now : sentAt,
      dueAt: dueFrom(now, body.media.lengthMinutes),
    },
  });
  return { ok: true, dueAt: row.dueAt.toISOString() };
}

/**
 * Marks what the friend sent as finished, then tells their site. Finishing again only retries
 * the telling — the date it was finished stays the first one.
 */
export async function finishReceived(id: string): Promise<ShareItem | null> {
  const row = await db.mediaShare.findUnique({ where: { id } });
  if (!row || row.direction !== "received") return null;
  const finished = row.finishedAt
    ? row
    : await db.mediaShare.update({ where: { id }, data: { finishedAt: new Date() } });
  if (finished.notifiedAt) return toItem(finished);

  const friend = friendConfig();
  if (!friend) return toItem(finished);
  try {
    await callFriend(friend, `/api/exchange/inbox/${id}/finished`, { finishedAt: finished.finishedAt!.toISOString() });
  } catch (e) {
    if (!(e instanceof ShareError)) throw e;
    // Not told: the portal offers to try again. A 404 is their site having no such item (it was
    // deleted there), so there is nothing left to tell.
    if (e.remoteStatus !== 404) return toItem(finished);
  }
  return toItem(await db.mediaShare.update({ where: { id }, data: { notifiedAt: new Date() } }));
}

/** The friend's site saying it finished what was sent from here. Null when there's no such item. */
export async function friendFinished(id: string, finishedAt: Date): Promise<boolean> {
  const row = await db.mediaShare.findUnique({ where: { id } });
  if (!row || row.direction !== "sent") return false;
  if (!row.finishedAt) {
    const now = new Date();
    await db.mediaShare.update({
      where: { id },
      data: { finishedAt: finishedAt > now || finishedAt < row.sentAt ? now : finishedAt },
    });
  }
  return true;
}
```

### `app/api/exchange/inbox/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { readJson, withErrors } from "@/lib/api-errors";
import { isMissingTable } from "@/lib/prisma-errors";
import { verifyFriendToken } from "@/lib/session";
import { SHARE_NOT_READY, inboxSchema } from "@/lib/media-share";
import { receive } from "@/lib/media-share-service";

/**
 * The friend's site sending something here, with EXCHANGE_TOKEN (docs/media-exchange.md). Answers
 * `{ dueAt }`: when it should be finished by, worked out here from its length.
 */
async function POSTHandler(request: NextRequest) {
  // The proxy lets this through on the token; the site's own session is not the friend.
  if (!(await verifyFriendToken(request.headers.get("authorization"), process.env.EXCHANGE_TOKEN))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = inboxSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const outcome = await receive(parsed.data);
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json({ dueAt: outcome.dueAt }, { status: 201 });
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ error: SHARE_NOT_READY }, { status: 503 });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
```

### `app/api/exchange/inbox/[id]/finished/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJson, withErrors } from "@/lib/api-errors";
import { isMissingTable } from "@/lib/prisma-errors";
import { verifyFriendToken } from "@/lib/session";
import { SHARE_NOT_READY } from "@/lib/media-share";
import { friendFinished } from "@/lib/media-share-service";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ finishedAt: z.iso.datetime({ offset: true }) });

/** The friend's site saying they finished what was sent from here, with EXCHANGE_TOKEN. */
async function POSTHandler(request: NextRequest, { params }: RouteContext) {
  if (!(await verifyFriendToken(request.headers.get("authorization"), process.env.EXCHANGE_TOKEN))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Send finishedAt as an ISO date." }, { status: 400 });

  try {
    if (!(await friendFinished(id, new Date(parsed.data.finishedAt)))) {
      return NextResponse.json({ error: "Nothing like that was sent from here." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ error: SHARE_NOT_READY }, { status: 503 });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
```

### `app/api/exchange/send/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { readJson, withErrors } from "@/lib/api-errors";
import { isMissingTable } from "@/lib/prisma-errors";
import { SHARE_NOT_READY, sendSchema } from "@/lib/media-share";
import { ShareError, sendToFriend } from "@/lib/media-share-service";

export const maxDuration = 60;

/** Send something to the friend's site: `{ kind, sourceId, note? }`. Its details are read here. */
async function POSTHandler(request: NextRequest) {
  const parsed = sendSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Pick something to send." }, { status: 400 });
  const { kind, sourceId, note } = parsed.data;

  try {
    const item = await sendToFriend(kind, sourceId, note || null);
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    if (e instanceof ShareError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (isMissingTable(e)) return NextResponse.json({ error: SHARE_NOT_READY }, { status: 503 });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
```

### `app/api/exchange/search/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { SHARE_KINDS, type ShareKind } from "@/lib/media-share";
import { ShareError, searchKind } from "@/lib/media-share-service";

export const maxDuration = 60;

/** Search a kind's catalogue to pick something to send: `?kind=anime&q=frieren`. */
async function GETHandler(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") ?? "";
  if (!(SHARE_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "Pick movie, tv, anime, manga or book." }, { status: 400 });
  }
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  // MyAnimeList wants three letters; the others take two.
  const least = kind === "anime" || kind === "manga" ? 3 : 2;
  if (q.length < least) {
    return NextResponse.json({ error: `Type at least ${least === 3 ? "three" : "two"} letters to search.` }, { status: 400 });
  }
  if (q.length > 100) return NextResponse.json({ error: "That search is too long." }, { status: 400 });

  try {
    return NextResponse.json({ results: await searchKind(kind as ShareKind, q) });
  } catch (e) {
    if (e instanceof ShareError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
```

### `app/api/exchange/[id]/finish/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { isMissingTable } from "@/lib/prisma-errors";
import { SHARE_NOT_READY } from "@/lib/media-share";
import { finishReceived } from "@/lib/media-share-service";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Mark what the friend sent as finished and tell their site. Again on a finished one only retries
 * telling them; `notifiedAt` in the answer says whether it got through.
 */
async function POSTHandler(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const item = await finishReceived(id);
    if (!item) return NextResponse.json({ error: "Nothing like that came from them." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ error: SHARE_NOT_READY }, { status: 503 });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
```

### `components/exchange/MediaExchange.tsx`

```tsx
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
          Set FRIEND_SITE_URL, FRIEND_NAME and EXCHANGE_TOKEN (the same 32+ characters on both sites) in Vercel, then redeploy.
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
```

### Auth middleware: the two token-only routes (excerpt of `lib/session.ts` and `proxy.ts`)

```ts
// REPORT_TOKEN_MIN_LENGTH = 32; encoder = new TextEncoder()
/**
 * Checks an `Authorization: Bearer …` header against the expected token.
 *
 * Fails closed: with the token unset or too short nothing matches, so a blank variable can never
 * turn into `"" === ""`. The comparison is over SHA-256 digests — always 32 bytes — with no early
 * exit, so it reveals neither the token's length nor where the first wrong character is.
 */
export async function verifyReportToken(
  header: string | null,
  expected: string | undefined,
): Promise<boolean> {
  const want = expected?.trim();
  if (!want || want.length < REPORT_TOKEN_MIN_LENGTH) return false;
  if (!header?.startsWith("Bearer ")) return false;
  const presented = header.slice("Bearer ".length).trim();
  if (presented === "") return false;

  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(presented)),
    crypto.subtle.digest("SHA-256", encoder.encode(want)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ─── The friend's site ───────────────────────────────────────────────────────

/**
 * The friend's site sends media here, and says when it's finished what was sent from here, with
 * EXCHANGE_TOKEN — the same value set on both sites. It opens these two calls and nothing else.
 * See docs/media-exchange.md.
 */
const FRIEND_ROUTES = [
  /^POST \/api\/exchange\/inbox$/,
  /^POST \/api\/exchange\/inbox\/[0-9a-f-]{36}\/finished$/,
];

/** Whether the friend's token may make this call: an exact method and path. */
export function friendMayCall(method: string, pathname: string): boolean {
  const call = `${method} ${pathname}`;
  return FRIEND_ROUTES.some((r) => r.test(call));
}

/** The same fail-closed check as REPORT_TOKEN's, against EXCHANGE_TOKEN. */
export const verifyFriendToken = verifyReportToken;

// In the middleware, before answering 401 to an unauthenticated request:
    // The friend's site: EXCHANGE_TOKEN, for sending media here and saying it finished ours.
    if (
      friendMayCall(request.method, pathname) &&
      (await verifyFriendToken(request.headers.get("authorization"), process.env.EXCHANGE_TOKEN))
    ) {
      return NextResponse.next();
    }
```
