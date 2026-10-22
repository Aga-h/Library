"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { APP_TIME_ZONE } from "@/lib/dates";
import { eaten, mealKey, WATER_ENTRY_MAX_ML, type Meal, type MealDay, type MealPlan, type PlanNote } from "@/lib/meal-plan";
import type { DayTracking, WaterEntry } from "@/lib/meal-plan-service";
import { inputCls } from "@/components/ui/form";

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE });
const kcal = (n: number) => n.toLocaleString("en-US");
const litres = (ml: number) => (ml / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** A request to the API; throws with a message to show. `goneIsFine`: a 404 counts as done. */
async function send(url: string, method: string, body?: unknown, goneIsFine = false): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error("Couldn't reach the site. Check the connection and try again.");
  }
  if (!res.ok && !(goneIsFine && res.status === 404)) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? "Something went wrong");
  }
  return res;
}

/**
 * One day of the diet plan: the figures, the water log, the meals and the plan's rules. On today
 * and earlier days the meals tick off and water is logged, and the figures count up toward the
 * day's plan. `tracking` is null on a day still ahead, or while migration 038 hasn't run
 * (`waiting`); the plan shows either way.
 */
export default function DayTracker({ date, plan, day, tracking, waiting }: {
  date: string;
  plan: Omit<MealPlan, "days" | "title">;
  day: MealDay;
  tracking: DayTracking | null;
  waiting: boolean;
}) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(tracking?.checked));
  const [water, setWater] = useState<WaterEntry[]>(tracking?.water ?? []);
  // Meals with a request in flight: a second tap waits, so two requests never race each other.
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tracked = tracking !== null;
  const ate = eaten(day, plan.home, checked);
  const drunk = water.reduce((n, w) => n + w.ml, 0);
  const goal = plan.water[day.kind] * 1000;

  const withKey = (set: ReadonlySet<string>, key: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(key);
    else next.delete(key);
    return next;
  };

  async function toggle(key: string) {
    if (saving.has(key)) return;
    const on = !checked.has(key);
    setChecked((s) => withKey(s, key, on));
    setSaving((s) => withKey(s, key, true));
    setError(null);
    try {
      await send("/api/self-care/meals", "PUT", { date, meal: key, checked: on });
    } catch (e) {
      setChecked((s) => withKey(s, key, !on));
      setError((e as Error).message);
    } finally {
      setSaving((s) => withKey(s, key, false));
    }
  }

  async function addWater(ml: number) {
    if (!Number.isInteger(ml) || ml < 1 || ml > WATER_ENTRY_MAX_ML) {
      setError(`Enter an amount from 1 to ${WATER_ENTRY_MAX_ML} ml`);
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const entry: WaterEntry = await (await send("/api/self-care/water", "POST", { date, ml })).json();
      setWater((w) => [...w, entry]);
      setAmount("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function removeWater(entry: WaterEntry) {
    const at = water.indexOf(entry);
    setWater((w) => w.filter((x) => x.id !== entry.id));
    setError(null);
    try {
      // A 404 means it is already gone, which is what was asked.
      await send(`/api/self-care/water/${entry.id}`, "DELETE", undefined, true);
    } catch (e) {
      setWater((w) => [...w.slice(0, at), entry, ...w.slice(at)]);
      setError((e as Error).message);
    }
  }

  const onAmount = (e: FormEvent) => {
    e.preventDefault();
    addWater(Number(amount));
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {tracked ? (
          <>
            <Tile label="kcal eaten" value={kcal(ate.kcal)} hint={`of ${kcal(day.total.kcal)}`} done={ate.kcal} of={day.total.kcal} />
            <Tile label="protein eaten" value={`~${ate.protein} g`} hint={`of ~${day.total.protein} g`} done={ate.protein} of={day.total.protein} />
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

      {error && (
        <p role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</p>
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
                <li key={w.id} className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs tabular-nums">
                  {TIME.format(new Date(w.at))} · {w.ml} ml
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

      <Meals meals={day.meals} checked={tracked ? checked : null} onToggle={toggle} />

      {day.home && (
        <details>
          <Summary>Weekends at home</Summary>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{plan.home.intro}</p>
            <Meals meals={plan.home.meals} home total={plan.home.total} checked={tracked ? checked : null} onToggle={toggle} />
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

/**
 * A plan's table. With `checked` (null on a day that can't be ticked) every row is a checkbox;
 * `home` rows are the at-home day's, whose figures are estimates and so all marked "~".
 */
function Meals({ meals, home = false, total, checked, onToggle }: {
  meals: Meal[];
  home?: boolean;
  total?: { kcal: number; protein: number };
  checked: ReadonlySet<string> | null;
  onToggle: (key: string) => void;
}) {
  const figures = (k: number | null, protein: number | null) =>
    k === null ? null : `${home ? "~" : ""}${kcal(k)} kcal${protein === null ? "" : ` · ~${protein} g protein`}`;
  const grid = "sm:grid sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4";
  return (
    <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
      {meals.map((meal) => {
        const key = mealKey(meal, home);
        const done = checked?.has(key) ?? false;
        const cells = (
          <>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">{meal.time}</span>
            <span className={`block text-sm break-words mt-0.5 sm:mt-0 ${done ? "text-gray-400 line-through" : "text-gray-900"}`}>{meal.what}</span>
            {meal.kcal !== null && (
              <span className="block text-xs text-gray-500 tabular-nums whitespace-nowrap mt-1 sm:mt-0 sm:text-right">{figures(meal.kcal, meal.protein)}</span>
            )}
          </>
        );
        return checked ? (
          <label key={key} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
            <input type="checkbox" checked={done} onChange={() => onToggle(key)} className="mt-0.5 w-5 h-5 flex-shrink-0" />
            <span className={`min-w-0 flex-1 ${grid}`}>{cells}</span>
          </label>
        ) : (
          <div key={key} className={`px-4 py-3 ${grid}`}>{cells}</div>
        );
      })}
      {total && (
        <div className="flex items-baseline justify-between gap-4 px-4 py-3 bg-gray-50 rounded-b-xl">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</p>
          <p className="text-sm font-semibold text-gray-900 tabular-nums">{figures(total.kcal, total.protein)}</p>
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
