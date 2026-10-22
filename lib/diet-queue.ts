// Offline queue for the Diet page: meals ticked and water logged while the site can't be reached —
// no signal, or a network that blocks the site (the school Wi-Fi does). Browser-only, IndexedDB,
// for the same reason as the expense queue: nothing in it may be evicted with script storage.
//
// It also keeps the last state the site confirmed for each day, so the page opened from the
// offline cache still shows what is already ticked, with the queue on top.

import type { DayTracking, WaterEntry } from "@/lib/meal-plan-service";
import { decideFromStatus } from "@/lib/expense-queue";

export type QueuedTick = { kind: "meal"; id: string; date: string; meal: string; checked: boolean; at: string };
export type QueuedWater = { kind: "water"; id: string; date: string; ml: number; at: string };
export type QueuedDiet = QueuedTick | QueuedWater;

/** A water entry on the page; `pending` while it is only in the queue. */
export type ShownWater = WaterEntry & { pending?: boolean };

export interface DietSyncResult {
  synced: number;
  remaining: number;
  /** Session expired. The queue is intact — the user needs to sign in again. */
  authRequired: boolean;
  /** Sync stopped early because the site is out of reach. */
  offline: boolean;
}

/** A tick's queue id: one per meal and day, so a later tick replaces an earlier one. */
export const tickId = (date: string, meal: string) => `meal:${date}:${meal}`;

// ─── Pure: the day with the queue on top ─────────────────────────────────────

/** What a day looks like: the last state the site confirmed, then everything queued for it. */
export function overlay(base: DayTracking, queued: QueuedDiet[], date: string): { checked: Set<string>; water: ShownWater[] } {
  const checked = new Set(base.checked);
  const water: ShownWater[] = [...base.water];
  const known = new Set(water.map((w) => w.id));
  for (const item of [...queued].sort((a, b) => a.at.localeCompare(b.at))) {
    if (item.date !== date) continue;
    if (item.kind === "meal") {
      if (item.checked) checked.add(item.meal);
      else checked.delete(item.meal);
    } else if (!known.has(item.id)) {
      // An entry the site already has (sent, answer lost) shows once, as the site's.
      water.push({ id: item.id, ml: item.ml, at: item.at, pending: true });
    }
  }
  return { checked, water };
}

// ─── IndexedDB plumbing ──────────────────────────────────────────────────────

const DB_NAME = "diet";
const DB_VERSION = 1;
const QUEUE = "queue";
const DAYS = "days";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(DAYS)) db.createObjectStore(DAYS, { keyPath: "date" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const req = fn(transaction.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        transaction.oncomplete = () => db.close();
      })
  );
}

export const listQueue = () => run<QueuedDiet[]>(QUEUE, "readonly", (s) => s.getAll() as IDBRequest<QueuedDiet[]>);
/** Adds an item, or replaces the one with its id: a meal's later tick replaces its earlier one. */
export const enqueue = (item: QueuedDiet) => run(QUEUE, "readwrite", (s) => s.put(item)).then(() => undefined);
export const dequeue = (id: string) => run(QUEUE, "readwrite", (s) => s.delete(id)).then(() => undefined);

/** The last state the site confirmed for a day, or null if this device has never seen it. */
export const loadDay = (date: string) =>
  run<(DayTracking & { date: string }) | undefined>(DAYS, "readonly", (s) => s.get(date)).then((d) =>
    d ? { checked: d.checked, water: d.water } : null
  );
export const saveDay = (date: string, day: DayTracking) =>
  run(DAYS, "readwrite", (s) => s.put({ date, checked: day.checked, water: day.water })).then(() => undefined);

// ─── Sync ────────────────────────────────────────────────────────────────────

/** A request to the site that gives up after a few seconds: a blocked connection can hang. */
export async function reach(url: string, method: string, body?: unknown): Promise<Response> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 8000);
  try {
    return await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: abort.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function send(item: QueuedDiet): Promise<Response> {
  return item.kind === "meal"
    ? reach("/api/self-care/meals", "PUT", { date: item.date, meal: item.meal, checked: item.checked })
    : // The queue id is the entry's id, so a second send is the same entry, not another.
      reach("/api/self-care/water", "POST", { id: item.id, date: item.date, ml: item.ml });
}

// Foreground signals overlap — `online`, focus, a page load — so passes are chained, never
// concurrent, as in the expense queue.
let syncChain: Promise<unknown> = Promise.resolve();

export function syncDiet(): Promise<DietSyncResult> {
  const next = syncChain.then(runSync, runSync);
  syncChain = next.catch(() => undefined);
  return next;
}

/** One pass, oldest first. An item leaves the queue once the site has answered it for good. */
async function runSync(): Promise<DietSyncResult> {
  const items = (await listQueue()).sort((a, b) => a.at.localeCompare(b.at));
  let synced = 0;
  let authRequired = false;
  let offline = false;
  for (const item of items) {
    let res: Response;
    try {
      res = await send(item);
    } catch {
      offline = true;
      break;
    }
    const decision = decideFromStatus(res.status);
    if (decision === "remove") {
      await dequeue(item.id);
      synced++;
    } else if (decision === "retain-auth") {
      authRequired = true;
      break;
    } else if (decision === "discard") {
      // The site will never take it (a day ahead, a meal the plan lacks): retrying can't help.
      await dequeue(item.id);
    }
  }
  return { synced, remaining: (await listQueue()).length, authRequired, offline };
}
