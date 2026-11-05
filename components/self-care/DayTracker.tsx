"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { MoreHorizontal, X } from "lucide-react";
import { APP_TIME_ZONE } from "@/lib/dates";
import { WATER_ENTRY_MAX_ML, type MealDay, type MealPlan, type PlanNote } from "@/lib/meal-plan";
import {
  balanceDay, DAY_FLOOR_KCAL, DAY_TOLERANCE_KCAL, EXTRA_KCAL_MAX, extraPresets,
  type DayBalance, type DayRow, type MealExtra, type MealState, type MealStates,
} from "@/lib/meal-adjust";
import type { DayTracking } from "@/lib/meal-plan-service";
import {
  dequeue, enqueue, listQueue, overlay, reach, saveDay, syncDiet, tickId,
  type QueuedDiet, type ShownWater,
} from "@/lib/diet-queue";
import { inputCls } from "@/components/ui/form";

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE });
const kcal = (n: number) => n.toLocaleString("en-US");
const litres = (ml: number) => (ml / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 });

const errorOf = async (res: Response) => ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong";

/**
 * One day of the diet plan: the figures, the water log, the meals and the plan's rules. On today
 * and earlier days each meal is marked eaten (the tick), eaten with more, or skipped, and water is
 * logged; the figures count up toward the day's plan, and the meals still open take add-ons or
 * trims so the day still lands on it (lib/meal-adjust.ts). `tracking` is null on a day still
 * ahead, or while migration 038 hasn't run (`waiting`); the plan shows either way.
 *
 * Without the site — no signal, or a network that blocks it — a mark or a glass of water is kept
 * in this device's queue and sent on the next chance: opening the page, coming back to it, going
 * online. `fromCache`: the page itself came from the offline cache, so `tracking` is this
 * device's last word from the site, not the site's.
 */
export default function DayTracker({ date, plan, day, tracking, waiting, fromCache }: {
  date: string;
  plan: Omit<MealPlan, "days" | "title">;
  day: MealDay;
  tracking: DayTracking | null;
  waiting: boolean;
  fromCache: boolean;
}) {
  const [meals, setMeals] = useState<MealStates>(() => tracking?.meals ?? {});
  const [water, setWater] = useState<ShownWater[]>(tracking?.water ?? []);
  // Meals with a request in flight: a second tap waits, so two requests never race each other.
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  // What this device is holding for the site, and why it is holding it.
  const [pending, setPending] = useState(0);
  const [signIn, setSignIn] = useState(false);
  const [stale, setStale] = useState(fromCache);
  // Skipping and extras wait for migration 041; a day from the cache doesn't know, so it offers them.
  const [choices, setChoices] = useState(tracking?.choices !== false);
  // The site's own last word on this day, which the queue is laid over.
  const confirmed = useRef<DayTracking>(tracking ?? { meals: {}, water: [] });
  // Known to be out of reach: queue straight away rather than wait for a request to time out.
  const offline = useRef(fromCache);

  const tracked = tracking !== null;

  const show = async () => {
    const queued = await listQueue();
    const v = overlay(confirmed.current, queued, date);
    setMeals(v.meals);
    setWater(v.water);
    setPending(queued.length);
  };

  const confirm = (next: DayTracking) => {
    confirmed.current = next;
    saveDay(date, next).catch(() => undefined);
  };

  /** Send what is queued, then take the site's word for this day. */
  const sync = async () => {
    const r = await syncDiet();
    setPending(r.remaining);
    setSignIn(r.authRequired);
    if (r.offline) {
      offline.current = true;
      return;
    }
    offline.current = false;
    let res: Response;
    try {
      res = await reach(`/api/self-care/day?date=${date}`, "GET");
    } catch {
      offline.current = true;
      return;
    }
    if (res.status === 401) setSignIn(true);
    if (!res.ok) return;
    const d = (await res.json()) as {
      meals: { key: string; status: MealState["status"] | null; changes: { id: string }[]; extras: MealExtra[] }[];
      water: { entries: DayTracking["water"] };
      choices: boolean;
    };
    const marked: MealStates = {};
    for (const m of d.meals) {
      if (m.status === "skipped") marked[m.key] = { status: "skipped", changes: [], extras: [] };
      else if (m.status === "ate") marked[m.key] = { status: "ate", changes: m.changes.map((c) => c.id), extras: m.extras };
    }
    confirm({ meals: marked, water: d.water.entries, choices: d.choices });
    setChoices(d.choices);
    setStale(false);
    await show();
  };

  useEffect(() => {
    if (!tracked) return;
    // A page fresh from the site: remember its word for when the site is out of reach.
    if (!fromCache && tracking) saveDay(date, tracking).catch(() => undefined);
    show().then(sync).catch(() => undefined);
    // iOS has no Background Sync, so every return to the page is the chance to send.
    const onSignal = () => {
      if (document.visibilityState === "visible") sync().catch(() => undefined);
    };
    window.addEventListener("online", onSignal);
    window.addEventListener("focus", onSignal);
    document.addEventListener("visibilitychange", onSignal);
    return () => {
      window.removeEventListener("online", onSignal);
      window.removeEventListener("focus", onSignal);
      document.removeEventListener("visibilitychange", onSignal);
    };
    // Once per day shown: DietDay keys this component by its date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Keep it for later. False if this browser can't (no IndexedDB), so the change is undone. */
  const hold = async (item: QueuedDiet) => {
    try {
      await enqueue(item);
      setPending((await listQueue()).length);
      return true;
    } catch {
      setError("Couldn't reach the site, and this browser can't keep it for later. Try again when you're online.");
      return false;
    }
  };
  const balance = balanceDay(day, plan, meals);
  const drunk = water.reduce((n, w) => n + w.ml, 0);
  const goal = plan.water[day.kind] * 1000;

  const withKey = (set: ReadonlySet<string>, key: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(key);
    else next.delete(key);
    return next;
  };
  const withMeal = (states: MealStates, key: string, state: MealState | null): MealStates => {
    const next = { ...states };
    if (state) next[key] = state;
    else delete next[key];
    return next;
  };

  /** Set what was done with a meal (null: still open), on the site or, without it, in the queue. */
  async function mark(key: string, state: MealState | null) {
    if (saving.has(key)) return;
    const before = meals[key] ?? null;
    const item: QueuedDiet = { kind: "meal", id: tickId(date, key), date, meal: key, state, at: new Date().toISOString() };
    const undo = () => setMeals((m) => withMeal(m, key, before));
    setMeals((m) => withMeal(m, key, state));
    setError(null);
    if (offline.current) {
      if (!(await hold(item))) undo();
      return;
    }
    setSaving((s) => withKey(s, key, true));
    try {
      const res = await reach("/api/self-care/meals", "PUT", {
        date, meal: key, status: state?.status ?? null, changes: state?.changes ?? [], extras: state?.extras ?? [],
      });
      if (res.ok) {
        // Any older mark of this meal still queued would undo this one when it syncs.
        await dequeue(item.id).catch(() => undefined);
        confirm({ ...confirmed.current, meals: withMeal(confirmed.current.meals, key, state) });
        // A sync that answered while this was on its way showed the site's older word: say it again.
        setMeals((m) => withMeal(m, key, state));
      } else if (res.status === 401) {
        setSignIn(true);
        if (!(await hold(item))) undo();
      } else {
        undo();
        setError(await errorOf(res));
      }
    } catch {
      offline.current = true;
      if (!(await hold(item))) undo();
    } finally {
      setSaving((s) => withKey(s, key, false));
    }
  }

  /** The add-ons or trims a meal would be eaten with now: what it shows while open. */
  const changesFor = (key: string) =>
    balanceDay(day, plan, withMeal(meals, key, null)).rows.find((r) => r.key === key)?.changes.map((c) => c.id) ?? [];

  const tick = (key: string) =>
    mark(key, meals[key]?.status === "ate" ? null : { status: "ate", changes: changesFor(key), extras: [] });
  const skip = (key: string) =>
    mark(key, meals[key]?.status === "skipped" ? null : { status: "skipped", changes: [], extras: [] });
  const addExtra = (key: string, extra: MealExtra) => {
    const now = meals[key];
    return mark(key, now?.status === "ate"
      ? { ...now, extras: [...now.extras, extra] }
      : { status: "ate", changes: changesFor(key), extras: [extra] });
  };
  const removeExtra = (key: string, at: number) => {
    const now = meals[key];
    if (now?.status === "ate") return mark(key, { ...now, extras: now.extras.filter((_, i) => i !== at) });
  };
  const actions: MealActions = { tick, skip, addExtra, removeExtra, saving, choices };

  async function addWater(ml: number) {
    if (!Number.isInteger(ml) || ml < 1 || ml > WATER_ENTRY_MAX_ML) {
      setError(`Enter an amount from 1 to ${WATER_ENTRY_MAX_ML} ml`);
      return;
    }
    // Its id is made here, so if it is sent twice — queued, then retried — it is logged once.
    const entry = { id: crypto.randomUUID(), ml, at: new Date().toISOString() };
    const item: QueuedDiet = { kind: "water", ...entry, date };
    const keep = async () => {
      if (await hold(item)) {
        setWater((w) => [...w, { ...entry, pending: true }]);
        setAmount("");
      }
    };
    setError(null);
    if (offline.current) return keep();
    setAdding(true);
    try {
      const res = await reach("/api/self-care/water", "POST", { id: entry.id, date, ml });
      if (res.ok) {
        const saved = await res.json();
        setWater((w) => [...w, saved]);
        confirm({ ...confirmed.current, water: [...confirmed.current.water, saved] });
        setAmount("");
      } else if (res.status === 401) {
        setSignIn(true);
        await keep();
      } else {
        setError(await errorOf(res));
      }
    } catch {
      offline.current = true;
      await keep();
    } finally {
      setAdding(false);
    }
  }

  async function removeWater(entry: ShownWater) {
    setError(null);
    if (entry.pending) {
      // Never sent: taking it out of the queue is all there is to it.
      await dequeue(entry.id).catch(() => undefined);
      setWater((w) => w.filter((x) => x.id !== entry.id));
      setPending((await listQueue().catch(() => [])).length);
      return;
    }
    const cant = "This one is on the site already, so it can only be taken back once the site can be reached.";
    if (offline.current) return setError(cant);
    const at = water.indexOf(entry);
    setWater((w) => w.filter((x) => x.id !== entry.id));
    const putBack = () => setWater((w) => [...w.slice(0, at), entry, ...w.slice(at)]);
    try {
      const res = await reach(`/api/self-care/water/${entry.id}`, "DELETE");
      // A 404 means it is already gone, which is what was asked.
      if (res.ok || res.status === 404) {
        confirm({ ...confirmed.current, water: confirmed.current.water.filter((x) => x.id !== entry.id) });
        setWater((w) => w.filter((x) => x.id !== entry.id));
      } else {
        putBack();
        setError(res.status === 401 ? "Sign in again to take this back." : await errorOf(res));
      }
    } catch {
      offline.current = true;
      putBack();
      setError(cant);
    }
  }

  const onAmount = (e: FormEvent) => {
    e.preventDefault();
    addWater(Number(amount));
  };

  const note = tracked && Object.keys(meals).length > 0 ? balanceNote(balance) : null;

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {tracked ? (
          <>
            <Tile label="kcal eaten" value={kcal(balance.eaten.kcal)} hint={`of ${kcal(balance.goal.kcal)}`} done={balance.eaten.kcal} of={balance.goal.kcal} />
            <Tile label="protein eaten" value={`~${balance.eaten.protein} g`} hint={`of ~${balance.goal.protein} g`} done={balance.eaten.protein} of={balance.goal.protein} />
            <Tile label="water" value={`${litres(drunk)} L`} hint={`of ${litres(goal)} L`} done={drunk} of={goal} />
          </>
        ) : (
          <>
            <Tile label="kcal" value={kcal(day.total.kcal)} hint={`target ${kcal(plan.target[day.kind])}`} />
            <Tile label="protein" value={`~${day.total.protein} g`} />
            <Tile label="water" value={`${litres(goal)} L`} hint={plan.waterNote} />
          </>
        )}
      </div>

      {day.note && (
        <p className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">{day.note}</p>
      )}

      {note && (
        <p role="status" className={`${note.warn ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-sky-50 border-sky-200 text-sky-800"} border rounded-xl px-4 py-3 text-sm`}>
          {note.text}
        </p>
      )}

      {error && (
        <p role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</p>
      )}

      {tracked && (signIn || pending > 0 || stale) && (
        <p role="status" className="bg-sky-50 border border-sky-200 text-sky-800 rounded-xl px-4 py-3 text-sm">
          {signIn ? (
            <>
              Sign in again to send {pending === 1 ? "the change" : `the ${pending} changes`} kept on this device.{" "}
              <Link href="/login?from=/self-care" className="font-semibold underline underline-offset-2">Sign in</Link>
            </>
          ) : pending > 0 ? (
            `${pending} change${pending === 1 ? "" : "s"} saved on this device — sent when the site can be reached.`
          ) : (
            "The site can't be reached, so this is what this device last heard from it. Meals and water are kept here and sent later."
          )}
        </p>
      )}

      {tracked && (
        <section>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Water</h3>
          <div className="flex flex-wrap items-center gap-2">
            {[250, 500].map((ml) => (
              <button key={ml} type="button" onClick={() => addWater(ml)} disabled={adding}
                className="px-3 py-2 max-sm:py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors">
                +{ml} ml
              </button>
            ))}
            <form onSubmit={onAmount} className="flex items-center gap-2">
              <div className="w-28">
                <input type="number" inputMode="numeric" min={1} max={WATER_ENTRY_MAX_ML} step={1} placeholder="ml"
                  aria-label="Water drunk, in ml" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
              </div>
              <button type="submit" disabled={adding || amount === ""}
                className="px-4 py-2 max-sm:py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
                {adding ? "Adding…" : "Add"}
              </button>
            </form>
          </div>
          {water.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 mt-3">
              {water.map((w) => (
                <li key={w.id} className={`flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs tabular-nums ${w.pending ? "opacity-60" : ""}`}>
                  {TIME.format(new Date(w.at))} · {w.ml} ml{w.pending && " · on this device"}
                  <button type="button" onClick={() => removeWater(w)} aria-label={`Remove ${w.ml} ml from ${TIME.format(new Date(w.at))}`}
                    className="p-1 max-sm:p-1.5 rounded-full text-sky-500 hover:text-sky-800 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-gray-400 mt-2">{plan.waterNote}.</p>
        </section>
      )}
      {waiting && (
        <p className="text-sm text-gray-500">
          Ticking meals off and logging water start once <code>038-diet-tracking.sql</code> has run in Supabase.
        </p>
      )}

      <Meals rows={balance.rows.filter((r) => !r.home)} actions={tracked ? actions : null} />
      {tracked && !choices && (
        <p className="text-sm text-gray-500">
          Skipping a meal and logging what you ate on top start once <code>041-meal-choices.sql</code> has run in Supabase.
        </p>
      )}

      {day.home && (
        <details open={balance.followHome || undefined}>
          <Summary>Weekends at home</Summary>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{plan.home.intro}</p>
            <Meals rows={balance.rows.filter((r) => r.home)} home total={plan.home.total} actions={tracked ? actions : null} />
            <Notes notes={plan.home.tips} />
          </div>
        </details>
      )}

      <details>
        <Summary>Rules</Summary>
        <Notes notes={plan.rules} />
      </details>
    </>
  );
}

/** What marking the meals did to the rest of the day, in a sentence or three. */
function balanceNote(b: DayBalance): { text: string; warn: boolean } | null {
  const parts: string[] = [];
  if (b.followHome) parts.push("Following the at-home day.");
  if (b.gymSkipped) parts.push(`No gym today, so it's a rest day: ${kcal(b.goal.kcal)} kcal.`);
  if (b.moved > 0) parts.push(`The meals still ahead pick up ${kcal(b.moved)} kcal (marked +) to make up for it.`);
  if (b.moved < 0) parts.push(`${kcal(-b.moved)} kcal comes off the meals still ahead (marked −). Protein stays.`);
  const off = b.projected.kcal - b.goal.kcal;
  const under = b.projected.kcal < DAY_FLOOR_KCAL;
  if (off < -DAY_TOLERANCE_KCAL) {
    parts.push(`Today ends at about ${kcal(b.projected.kcal)} kcal, ${kcal(-off)} under the plan${under ? `, and under its ${kcal(DAY_FLOOR_KCAL)} floor` : ""}.`);
  } else if (off > DAY_TOLERANCE_KCAL) {
    parts.push(`Today ends at about ${kcal(b.projected.kcal)} kcal, ${kcal(off)} over the plan. Tomorrow stays as planned.`);
  }
  return parts.length ? { text: parts.join(" "), warn: under } : null;
}

/** What a meal row can do on a day that is being tracked. */
type MealActions = {
  tick: (key: string) => void;
  skip: (key: string) => void;
  addExtra: (key: string, extra: MealExtra) => void;
  removeExtra: (key: string, at: number) => void;
  saving: ReadonlySet<string>;
  /** Skipping and extras: false until migration 041 has run. */
  choices: boolean;
};

/**
 * A plan's table. With `actions` (null on a day that can't be marked) every row is a checkbox for
 * "ate it", with ⋯ for the other choices; `home` rows are the at-home day's, whose figures are
 * estimates and so all marked "~".
 */
function Meals({ rows, home = false, total, actions }: {
  rows: DayRow[];
  home?: boolean;
  total?: { kcal: number; protein: number };
  actions: MealActions | null;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
      {rows.map((row) => <MealRow key={row.key} row={row} home={home} actions={actions} />)}
      {total && (
        <div className="flex items-baseline justify-between gap-4 px-4 py-3 bg-gray-50 rounded-b-xl">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</p>
          <p className="text-sm font-semibold text-gray-900 tabular-nums">{figures(home, total.kcal, total.protein)}</p>
        </div>
      )}
    </div>
  );
}

const figures = (home: boolean, k: number, protein: number | null) =>
  `${home ? "~" : ""}${kcal(k)} kcal${protein === null ? "" : ` · ~${protein} g protein`}`;
const signed = (n: number) => `${n < 0 ? "−" : "+"}${kcal(Math.abs(n))}`;

function MealRow({ row, home, actions }: { row: DayRow; home: boolean; actions: MealActions | null }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const { key, meal, state } = row;
  const ate = state?.status === "ate";
  const skipped = state?.status === "skipped";
  const extras = ate ? state.extras : [];
  const changed = row.changes.length > 0 || extras.length > 0;
  const grid = "sm:grid sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4";

  const cells = (
    <>
      <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {meal.time}{skipped && " · skipped"}
      </span>
      <span className="block min-w-0 mt-0.5 sm:mt-0">
        <span className={`block text-sm break-words ${ate ? "text-gray-400 line-through" : skipped ? "text-gray-400" : "text-gray-900"}`}>
          {meal.what}
        </span>
        {row.changes.map((c) => (
          <span key={c.id} className={`block text-xs mt-1 ${c.kcal > 0 ? "text-sky-800" : "text-gray-600"}`}>
            {c.kcal > 0 ? "+" : "−"} {c.label} · {signed(c.kcal)} kcal{c.protein !== 0 && ` · ${signed(c.protein)} g`}
          </span>
        ))}
        {extras.map((e, i) => (
          <span key={i} className="block text-xs mt-1 text-sky-800">+ {e.label} · {kcal(e.kcal)} kcal · ate more</span>
        ))}
      </span>
      {(meal.kcal !== null || changed) && (
        <span className={`block text-xs tabular-nums whitespace-nowrap mt-1 sm:mt-0 sm:text-right ${skipped ? "text-gray-400 line-through" : "text-gray-500"}`}>
          {changed ? figures(home, row.kcal, row.protein || null) : figures(home, meal.kcal ?? 0, meal.protein)}
          {changed && meal.kcal !== null && <span className="block text-[11px] text-gray-400">plan {kcal(meal.kcal)}</span>}
        </span>
      )}
    </>
  );
  if (!actions) return <div className={`px-4 py-3 ${grid}`}>{cells}</div>;

  const busy = actions.saving.has(key);
  const customKcal = Number(custom);
  const customOk = Number.isInteger(customKcal) && customKcal >= 1 && customKcal <= EXTRA_KCAL_MAX;
  const onCustom = (e: FormEvent) => {
    e.preventDefault();
    if (!customOk) return;
    actions.addExtra(key, { label: "Something else", kcal: customKcal, protein: 0 });
    setCustom("");
  };

  return (
    <div>
      <div className="flex items-start">
        <label className="flex items-start gap-3 pl-4 pr-1 py-3 flex-1 min-w-0 cursor-pointer hover:bg-gray-50 transition-colors">
          <input type="checkbox" checked={ate} onChange={() => actions.tick(key)} className="mt-0.5 w-5 h-5 flex-shrink-0" />
          <span className={`min-w-0 flex-1 ${grid}`}>{cells}</span>
        </label>
        {actions.choices && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            aria-label={`${meal.time}: skip it, or log what you ate on top`}
            className="m-2 p-2 max-sm:p-2.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>
      {open && actions.choices && (
        <div className="px-4 pb-3 sm:pl-12 space-y-2">
          <button type="button" onClick={() => { actions.skip(key); setOpen(false); }} disabled={busy}
            className="px-3 py-2 max-sm:py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors">
            {skipped ? "Eating it after all" : "Didn't / won't eat it"}
          </button>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">Ate more</p>
          <div className="flex flex-wrap gap-1.5">
            {extraPresets(meal).map((e) => (
              <button key={e.label} type="button" onClick={() => actions.addExtra(key, e)} disabled={busy}
                className="px-2.5 py-1 max-sm:py-1.5 rounded-full bg-sky-50 text-sky-800 text-xs tabular-nums hover:bg-sky-100 disabled:opacity-50 transition-colors">
                + {e.label} · {kcal(e.kcal)}
              </button>
            ))}
          </div>
          <form onSubmit={onCustom} className="flex items-center gap-2">
            <div className="w-28">
              <input type="number" inputMode="numeric" min={1} max={EXTRA_KCAL_MAX} step={1} placeholder="kcal"
                aria-label={`Something else eaten at ${meal.time}, in kcal`} value={custom}
                onChange={(e) => setCustom(e.target.value)} className={inputCls} />
            </div>
            <button type="submit" disabled={busy || !customOk}
              className="px-3 py-2 max-sm:py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors">
              Add
            </button>
          </form>
          {extras.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {extras.map((e, i) => (
                <li key={i} className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs tabular-nums">
                  {e.label} · {kcal(e.kcal)} kcal
                  <button type="button" onClick={() => actions.removeExtra(key, i)} disabled={busy} aria-label={`Take back ${e.label}`}
                    className="p-1 max-sm:p-1.5 rounded-full text-sky-500 hover:text-sky-800 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Notes({ notes }: { notes: PlanNote[] }) {
  return (
    <ul className="space-y-2 text-sm text-gray-600">
      {notes.map((n) => (
        <li key={n.lead}><span className="font-semibold text-gray-900">{n.lead}</span> {n.text}</li>
      ))}
    </ul>
  );
}

function Summary({ children }: { children: React.ReactNode }) {
  return (
    <summary className="cursor-pointer py-2.5 sm:py-1 mb-2 text-xs font-bold text-gray-400 uppercase tracking-wide hover:text-gray-600">
      {children}
    </summary>
  );
}

/** A figure; with `done` and `of`, a bar showing how far toward it the day has come. */
function Tile({ label, value, hint, done, of }: { label: string; value: string; hint?: string; done?: number; of?: number }) {
  const fraction = done === undefined || !of ? null : Math.min(done / of, 1);
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 max-sm:px-3 py-3">
      <p className="text-2xl max-sm:text-xl font-bold text-gray-900 tabular-nums break-words">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
      {fraction !== null && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
          <div className={`h-full rounded-full ${fraction >= 1 ? "bg-emerald-500" : "bg-sky-500"}`} style={{ width: `${Math.round(fraction * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
