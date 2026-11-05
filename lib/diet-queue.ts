// Offline queue for the Diet page: meals marked and water logged while the site can't be reached —
// no signal, or a network that blocks the site (the school Wi-Fi does). Browser-only, IndexedDB,
// for the same reason as the expense queue: nothing in it may be evicted with script storage.
//
// It also keeps the last state the site confirmed for each day, so the page opened from the
// offline cache still shows what is already marked, with the queue on top.

import type { DayTracking, WaterEntry } from "@/lib/meal-plan-service";
import { statesFromChecked, type MealState, type MealStates } from "@/lib/meal-adjust";
import { decideFromStatus } from "@/lib/expense-queue";

/**
 * A meal marked: `state` is what was done with it, null to take the mark off. Ticks queued before
 * there were choices carry `checked` instead, and are still sent as they were.
 */
export type QueuedTick =
  | { kind: "meal"; id: string; date: string; meal: string; state: MealState | null; at: string }
  | { kind: "meal"; id: string; date: string; meal: string; checked: boolean; at: string };
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

/** A mark's queue id: one per meal and day, so a later mark replaces an earlier one. */
export const tickId = (date: string, meal: string) => `meal:${date}:${meal}`;

// ─── Pure: the day with the queue on top ─────────────────────────────────────

/** What a queued mark sets the meal to. */
export const queuedState = (item: QueuedTick): MealState | null =>
  "state" in item ? item.state : item.checked ? { status: "ate", changes: [], extras: [] } : null;

/** What a day looks like: the last state the site confirmed, then everything queued for it. */
export function overlay(base: DayTracking, queued: QueuedDiet[], date: string): { meals: MealStates; water: ShownWater[] } {
  const meals: MealStates = { ...base.meals };
  const water: ShownWater[] = [...base.water];
  const known = new Set(water.map((w) => w.id));
  for (const item of [...queued].sort((a, b) => a.at.localeCompare(b.at))) {
    if (item.date !== date) continue;
    if (item.kind === "meal") {
      const state = queuedState(item);
      if (state) meals[item.meal] = state;
      else delete meals[item.meal];
    } else if (!known.has(item.id)) {
      // An entry the site already has (sent, answer lost) shows once, as the site's.
      water.push({ id: item.id, ml: item.ml, at: item.at, pending: true });
    }
  }
  return { meals, water };
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
/** Adds an item, or replaces the one with its id: a meal's later mark replaces its earlier one. */
export const enqueue = (item: QueuedDiet) => run(QUEUE, "readwrite", (s) => s.put(item)).then(() => undefined);
export const dequeue = (id: string) => run(QUEUE, "readwrite", (s) => s.delete(id)).then(() => undefined);

/** A day as saved: since the choices came in, its meals; before, the meals ticked. */
type SavedDay = { date: string; meals?: MealStates; checked?: string[]; water: WaterEntry[]; choices?: boolean };

/** The last state the site confirmed for a day, or null if this device has never seen it. */
export const loadDay = (date: string) =>
  run<SavedDay | undefined>(DAYS, "readonly", (s) => s.get(date)).then((d): DayTracking | null =>
    d ? { meals: d.meals ?? statesFromChecked(d.checked ?? []), water: d.water, choices: d.choices } : null
  );
export const saveDay = (date: string, day: DayTracking) =>
  run(DAYS, "readwrite", (s) => s.put({ date, meals: day.meals, water: day.water, choices: day.choices })).then(() => undefined);

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
  if (item.kind === "meal") {
    const body = "state" in item
      ? { date: item.date, meal: item.meal, status: item.state?.status ?? null, changes: item.state?.changes ?? [], extras: item.state?.extras ?? [] }
      : { date: item.date, meal: item.meal, checked: item.checked };
    return reach("/api/self-care/meals", "PUT", body);
  }
  // The queue id is the entry's id, so a second send is the same entry, not another.
  return reach("/api/self-care/water", "POST", { id: item.id, date: item.date, ml: item.ml });
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
