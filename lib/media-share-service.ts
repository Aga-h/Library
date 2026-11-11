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
  MAX_OPEN, dueFrom, fromAnime, fromBook, fromFilm, fromManga, fromShow, friendBaseUrl, isSourceId, shareMediaSchema,
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

/**
 * What's wrong with the setup, said on the portal without showing any value — so "I set them"
 * can be told apart from "this deployment doesn't have them". Null when friendConfig() works.
 */
export function friendSetupIssue(): string | null {
  const url = process.env.FRIEND_SITE_URL?.trim();
  const token = process.env.EXCHANGE_TOKEN?.trim();
  if (!url && !token) return "This deployment has neither FRIEND_SITE_URL nor EXCHANGE_TOKEN. Set them for Production in Vercel, then redeploy.";
  if (!url) return "This deployment has no FRIEND_SITE_URL. Set it for Production in Vercel, then redeploy.";
  if (!friendBaseUrl(url)) return "FRIEND_SITE_URL has to be a full https address, like https://www.their.site.";
  if (!token) return "This deployment has no EXCHANGE_TOKEN. Set it for Production in Vercel, then redeploy.";
  if (token.length < 32) return `EXCHANGE_TOKEN is ${token.length} characters; it needs 32 or more (and the same value on both sites).`;
  return null;
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

const items = (rows: Row[]) => rows.map(toItem).filter((i): i is ShareItem => i !== null);

async function openCount(direction: "sent" | "received"): Promise<number> {
  return db.mediaShare.count({ where: { direction, finishedAt: null } });
}

export interface ExchangeState {
  friend: { name: string } | null;
  /** Why `friend` is null: what to fix in the environment. */
  setupIssue: string | null;
  /** Sent to the friend and not finished yet, newest first. */
  sent: ShareItem[];
  /** The last few the friend finished, most recently finished first. */
  sentDone: ShareItem[];
  /** From the friend: not finished yet, or finished but their site not told yet. Newest first. */
  received: ShareItem[];
  /** The last one finished here and told to their site. */
  receivedDone: ShareItem | null;
}

/** What the portal shows. Null until migration 042 has run. */
export async function exchangeState(): Promise<ExchangeState | null> {
  const friend = friendConfig();
  const newest = { sentAt: "desc" } as const;
  try {
    const [sent, sentDone, received, receivedDone] = await Promise.all([
      db.mediaShare.findMany({ where: { direction: "sent", finishedAt: null }, orderBy: newest, take: MAX_OPEN }),
      db.mediaShare.findMany({ where: { direction: "sent", finishedAt: { not: null } }, orderBy: { finishedAt: "desc" }, take: 3 }),
      db.mediaShare.findMany({ where: { direction: "received", notifiedAt: null }, orderBy: newest, take: MAX_OPEN }),
      db.mediaShare.findFirst({ where: { direction: "received", notifiedAt: { not: null } }, orderBy: { finishedAt: "desc" } }),
    ]);
    return {
      friend: friend ? { name: friend.name } : null,
      setupIssue: friendSetupIssue(),
      sent: items(sent),
      sentDone: items(sentDone),
      received: items(received),
      receivedDone: receivedDone ? toItem(receivedDone) : null,
    };
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

  if ((await openCount("sent")) >= MAX_OPEN) {
    throw new ShareError(`${MAX_OPEN} are already waiting for ${friend.name} — let them catch up first.`, 409);
  }

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
 * Something sent from the friend's site, queued behind whatever is still open here. The same id
 * again is answered the same way (a retry). Past MAX_OPEN open items, more are refused.
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
  if ((await openCount("received")) >= MAX_OPEN) {
    return { ok: false, status: 409, error: `${MAX_OPEN} are already waiting here — finish some first.` };
  }

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
