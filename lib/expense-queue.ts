// Offline queue for expense logging. Browser-only — uses IndexedDB.
//
// IndexedDB rather than localStorage deliberately: Safari's tracking prevention can evict
// script-writable storage, and the whole point of this queue is that an entry is never lost.

export interface QueuedExpense {
  id: string;
  year: number;
  month: number;
  category: string;
  amount: number;
  description?: string;
  /** When the user actually entered it, which may be long before it uploads. */
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface SyncResult {
  synced: number;
  remaining: number;
  /** Session expired. The queue is intact — the user needs to sign in again. */
  authRequired: boolean;
  /** Items the server will never accept, so they were dropped rather than retried forever. */
  rejected: { item: QueuedExpense; reason: string }[];
  /** Sync stopped early because the network is unreachable. */
  offline: boolean;
}

const DB_NAME = "expense-logger";
const DB_VERSION = 1;
const STORE = "queue";

// ─── Pure decision logic ─────────────────────────────────────────────────────
// Split out from the IO so it can be tested without a browser. Getting this table
// wrong is how a queue silently eats someone's data.

export type SyncDecision =
  | "remove" // accepted by the server
  | "discard" // permanently invalid, retrying can never help
  | "retain-auth" // keep; session expired
  | "retain-retry"; // keep; transient

export function decideFromStatus(status: number): SyncDecision {
  if (status === 201 || status === 200) return "remove";
  if (status === 401 || status === 403) return "retain-auth";
  // 400 is a schema rejection and 404 means the month path is impossible — neither
  // will ever succeed on retry. Everything else (429, 5xx, anything unexpected) is
  // treated as transient, because keeping an entry is always safer than dropping it.
  if (status === 400 || status === 404) return "discard";
  return "retain-retry";
}

// ─── IndexedDB plumbing ──────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const req = fn(transaction.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        transaction.oncomplete = () => db.close();
      })
  );
}

export function listQueue(): Promise<QueuedExpense[]> {
  return run<QueuedExpense[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedExpense[]>).then(
    (items) => items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  );
}

export async function queueCount(): Promise<number> {
  return (await listQueue()).length;
}

export async function enqueue(
  input: Omit<QueuedExpense, "id" | "createdAt" | "attempts">
): Promise<QueuedExpense> {
  const item: QueuedExpense = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await run("readwrite", (s) => s.put(item));
  return item;
}

async function remove(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}

async function bumpAttempts(item: QueuedExpense, lastError: string): Promise<void> {
  await run("readwrite", (s) => s.put({ ...item, attempts: item.attempts + 1, lastError }));
}

// ─── Sync ────────────────────────────────────────────────────────────────────

async function postExpense(item: QueuedExpense): Promise<Response> {
  return fetch(`/api/finances/${item.year}/${item.month}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Same-origin, so the session cookie rides along automatically.
    credentials: "same-origin",
    body: JSON.stringify({
      // The queue id doubles as the idempotency key. Retries, concurrent syncs and a
      // second tab all send the same one, so the server collapses them to one expense.
      clientId: item.id,
      category: item.category,
      amount: item.amount,
      ...(item.description ? { description: item.description } : {}),
    }),
  });
}

// Sync triggers overlap in practice: coming back online fires the `online` event and a
// navigation at the same time. Two concurrent passes both read the same queued item, both
// POST it, and both succeed — producing a duplicate expense. Serialising every call through
// one chain makes that impossible.
let syncChain: Promise<unknown> = Promise.resolve();

export function syncQueue(): Promise<SyncResult> {
  const next = syncChain.then(runSync, runSync);
  // Keep the chain alive even if a pass rejects, or every later sync would reject too.
  syncChain = next.catch(() => undefined);
  return next;
}

/**
 * One sync pass. Never call directly — go through `syncQueue` so passes stay serialised.
 * An item is only removed after the server has actually accepted it.
 */
async function runSync(): Promise<SyncResult> {
  const items = await listQueue();
  const rejected: SyncResult["rejected"] = [];
  let synced = 0;
  let authRequired = false;
  let offline = false;

  for (const item of items) {
    let res: Response;
    try {
      res = await postExpense(item);
    } catch {
      // Network unreachable. Stop — the rest will fail identically, and hammering
      // them would just inflate every attempt counter.
      await bumpAttempts(item, "offline");
      offline = true;
      break;
    }

    const decision = decideFromStatus(res.status);

    if (decision === "remove") {
      await remove(item.id);
      synced++;
    } else if (decision === "retain-auth") {
      // Session expired. Keep everything and stop; the user must sign in again.
      authRequired = true;
      break;
    } else if (decision === "discard") {
      const body = await res.json().catch(() => ({}));
      rejected.push({ item, reason: body.error ?? `Rejected (${res.status})` });
      await remove(item.id);
    } else {
      await bumpAttempts(item, `Server returned ${res.status}`);
    }
  }

  return { synced, remaining: await queueCount(), authRequired, rejected, offline };
}
