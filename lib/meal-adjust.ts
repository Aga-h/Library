/**
 * What was done with each meal of a day, and the rest of the day rebalanced around it.
 *
 * A meal is eaten ("ate", with anything eaten on top of it), skipped (didn't or won't eat it), or
 * still open. When the day comes to more or less than the plan's total, the open meals take
 * add-ons (an extra yoğurt, ½ scoop of whey, ½ portion of rice) or trims (no oil on the salad, the
 * shake without the 3ü1, no rice) until the day is back within 50 kcal of the plan. Only the rest
 * of today moves: tomorrow is planned as it was.
 *
 * The rules, from the plan: protein is never what gets cut, and short protein is made up first;
 * a day shouldn't end under 1,700 kcal; a gym day whose session is skipped is a rest day.
 *
 * A meal's add-ons and trims are worked out from its row in the plan alone, so the site can check
 * the ones a device sends. When a meal is eaten, the changes shown for it then are kept with it:
 * marking a later meal can't rewrite what an earlier one was.
 */
import { tickableMeals, type Meal, type MealDay, type MealPlan } from "@/lib/meal-plan";

export type MealStatus = "ate" | "skipped";
/** Eaten on top of a meal: a slice of bread, a dessert. */
export type MealExtra = { label: string; kcal: number; protein: number };
export type MealState = { status: MealStatus; changes: string[]; extras: MealExtra[] };
/** Keyed by meal key (see mealKey). A meal not in it is still open. */
export type MealStates = Record<string, MealState>;

/** An add-on (positive kcal) or a trim (negative) one meal can take. */
export type Change = {
  id: string;
  label: string;
  kcal: number;
  protein: number;
  /** Changes of one group are alternatives: ½ scoop or 1 scoop of whey, never both. */
  group: string;
  /** Trims go cheapest first: what costs no protein before what costs a little. */
  priority: number;
};

/** The plan's own leeway: every day lands within about 50 kcal of its target. */
export const DAY_TOLERANCE_KCAL = 50;
/** "Never go below 1,700 kcal on any day." */
export const DAY_FLOOR_KCAL = 1700;

export const EXTRAS_MAX = 10;
export const EXTRA_KCAL_MAX = 3000;
export const EXTRA_PROTEIN_MAX = 150;
export const EXTRA_LABEL_MAX = 60;

type Slot = "shake" | "gym" | "main" | "breakfast" | "snack11" | "afternoon" | "other";

function slotOf(meal: Meal): Slot {
  if (/^Shake\b/.test(meal.what)) return "shake";
  if (/^Gym\b/.test(meal.what)) return "gym";
  if (meal.time === "Lunch" || /dinner/i.test(meal.time)) return "main";
  if (meal.time === "Breakfast") return "breakfast";
  if (meal.time === "11:00" && meal.kcal !== null) return "snack11";
  if (meal.time === "16:00" || meal.time === "Afternoon") return "afternoon";
  return "other";
}

/** "Yayla çorba (173) + Lahmacun (247) + …": each dish with its menu kcal, in order. */
export function dishesOf(what: string): { name: string; kcal: number }[] {
  const out: { name: string; kcal: number }[] = [];
  for (const part of what.split(" + ")) {
    const m = part.match(/^(.*?)\s*\(~?(\d+)[,)]/);
    if (m) out.push({ name: m[1].trim(), kcal: Number(m[2]) });
  }
  return out;
}

const SOUP = /çorba/i;
const CARB_SIDE = /pilav|bulgur|spagetti|erişte|makarna/i;
const AYRAN = /^ayran$/i;

/** The main dish of a cafeteria meal: its first dish that isn't soup, a side, a drink or salad. */
export function mainDish(meal: Meal): { name: string; kcal: number } | null {
  const dishes = dishesOf(meal.what);
  return dishes.find((d, i) =>
    !SOUP.test(d.name) && !(i > 0 && CARB_SIDE.test(d.name)) && !/^(yoğurt|ayran|cacık|salad)/i.test(d.name)
  ) ?? null;
}

/**
 * Every add-on and trim a meal can take, from its row alone. Cafeteria rows carry the menu's kcal
 * in brackets; the at-home rows don't, and use the plan's home portions instead.
 */
export function mealOptions(meal: Meal): Change[] {
  const out: Change[] = [];
  const add = (id: string, label: string, kcal: number, protein: number, group = id) =>
    out.push({ id, label, kcal, protein, group, priority: 0 });
  const trim = (id: string, label: string, kcal: number, protein: number, priority: number) =>
    out.push({ id, label, kcal: -kcal, protein: -protein, group: id, priority });
  const cafeteria = /\(\d+\)/.test(meal.what);

  switch (slotOf(meal)) {
    case "shake":
      // The plan's own way to more protein: 1½ scoops.
      add("whey-half", "½ scoop more whey", 62, 12, "whey");
      add("whey-one", "1 scoop more whey", 123, 24, "whey");
      if (/3ü1/.test(meal.what)) trim("no-3u1", "the shake without the 3ü1", 80, 0, 1);
      break;
    case "main": {
      if (cafeteria) {
        add("yogurt", "an extra yoğurt", 122, 6);
        add("carb-half", "½ portion of rice, bulgur or pasta", 125, 3, "carb");
        add("carb-one", "a portion of rice, bulgur or pasta", 250, 5, "carb");
        if (!SOUP.test(meal.what)) add("soup", "the day's soup", 190, 7);
      } else {
        add("yogurt", "another bowl of yogurt", 122, 6);
        add("carb-half", "half a fist more rice, bulgur or pasta (~50 g cooked)", 65, 1, "carb");
        add("carb-one", "a fist more rice, bulgur or pasta (~100 g cooked)", 150, 3, "carb");
      }
      if (/1 tsp oil/.test(meal.what)) trim("no-oil", "no oil on the salad", 40, 0, 2);
      if (cafeteria) {
        dishesOf(meal.what).forEach((d, i) => {
          if (i > 0 && CARB_SIDE.test(d.name)) trim(`drop:${d.name}`, `skip the ${d.name}`, d.kcal, Math.round(d.kcal / 50), 4);
          else if (AYRAN.test(d.name)) trim(`drop:${d.name}`, "water instead of the ayran", d.kcal, Math.round(d.kcal / 20), 5);
          else if (SOUP.test(d.name)) trim(`drop:${d.name}`, `skip the ${d.name}`, d.kcal, Math.round(d.kcal / 25), 6);
        });
      } else if (/half a fist of rice/.test(meal.what)) {
        trim("drop:rice", "skip the rice, bulgur or pasta", 65, 1, 4);
      } else if (/a fist of rice/.test(meal.what)) {
        trim("drop:rice", "skip the rice, bulgur or pasta", 150, 3, 4);
      }
      break;
    }
    case "breakfast":
      add("cheese", "1 more slice of beyaz peynir", 90, 5);
      break;
    case "snack11":
      add("dairy", "a second süt, kefir or yoğurt from the snack table", 122, 6);
      if (/süt \+ fruit/.test(meal.what)) trim("no-fruit", "skip the fruit", 46, 0, 3);
      break;
    case "afternoon":
      if (meal.kcal === null) add("snack", "yoğurt + fruit from the snack table", 168, 8);
      else if (/^The süt/.test(meal.what)) add("fruit", "fruit from the snack table", 46, 0);
      else if (/^Yoğurt \+ fruit/.test(meal.what)) trim("no-fruit", "just the yoğurt, no fruit", 46, 0, 3);
      else if (/^1 piece of fruit \+ a bowl of yogurt/.test(meal.what)) {
        add("yogurt", "another bowl of yogurt", 122, 6);
        trim("no-fruit", "just the yogurt, no fruit", 70, 0, 3);
      }
      // The fruit before training stays: it's the session's fuel.
      break;
  }
  return out;
}

/** Quick picks for "Ate more". Rough figures, as the plan's own for things it doesn't count. */
export function extraPresets(meal: Meal): MealExtra[] {
  const out: MealExtra[] = [];
  const main = slotOf(meal) === "main" ? mainDish(meal) : null;
  if (main) {
    const protein = meal.kcal && meal.protein ? Math.round((meal.protein * main.kcal) / meal.kcal) : 0;
    out.push({ label: `Seconds of the ${main.name}`, kcal: main.kcal, protein });
  }
  out.push(
    { label: "A slice of bread", kcal: 75, protein: 2 },
    { label: "Sütlaç", kcal: 111, protein: 3 },
    { label: "A dessert or cake", kcal: 300, protein: 4 },
    { label: "Simit, poğaça or börek", kcal: 300, protein: 8 },
  );
  return out;
}

/** One row of the day, as it stands. */
export type DayRow = {
  key: string;
  meal: Meal;
  home: boolean;
  /** null: still open. */
  state: MealState | null;
  /** Kept with an eaten meal, or proposed for an open one. Empty on a skipped one. */
  changes: Change[];
  /** What the row comes to: its plan figures with the changes and extras; 0 when skipped. */
  kcal: number;
  protein: number;
  /** Part of the day being followed. The rows of the other plan (cafeteria vs at home) aren't. */
  counted: boolean;
};

export type DayBalance = {
  rows: DayRow[];
  /** The day's total in the plan, less the gym's share when the session is skipped. */
  goal: { kcal: number; protein: number };
  eaten: { kcal: number; protein: number };
  /** Eaten, plus the open meals with their proposed changes: where the day will end. */
  projected: { kcal: number; protein: number };
  /** Some at-home meal is marked, so the day follows the at-home plan. */
  followHome: boolean;
  gymSkipped: boolean;
  /** kcal the open meals were changed by: + added, − trimmed, 0 when nothing moved. */
  moved: number;
};

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((n, x) => n + f(x), 0);

/**
 * The day with what was done so far, and the open meals rebalanced. `states` may name meals the
 * day doesn't have (ignored) and changes a meal can't take (ignored).
 */
export function balanceDay(day: MealDay, plan: Pick<MealPlan, "home" | "target">, states: MealStates): DayBalance {
  const all = tickableMeals(day, plan.home);
  // On a day with an at-home option, the cafeteria rows are the day until an at-home row is marked.
  const followHome = !!day.home && all.some((t) => t.key.startsWith("home:") && states[t.key]);

  const rows: DayRow[] = all.map(({ key, meal }) => {
    const home = key.startsWith("home:");
    const state = states[key] ?? null;
    const options = mealOptions(meal);
    const changes = state?.status === "ate"
      ? state.changes.map((id) => options.find((o) => o.id === id)).filter((o): o is Change => !!o)
      : [];
    const extras = state?.status === "ate" ? state.extras : [];
    const skipped = state?.status === "skipped";
    return {
      key, meal, home, state, changes,
      kcal: skipped ? 0 : (meal.kcal ?? 0) + sum(changes, (c) => c.kcal) + sum(extras, (e) => e.kcal),
      protein: skipped ? 0 : (meal.protein ?? 0) + sum(changes, (c) => c.protein) + sum(extras, (e) => e.protein),
      // The rows of the plan not followed still count what was eaten from them.
      counted: !day.home || (followHome ? home || state?.status === "ate" : !home),
    };
  });

  const goal = { ...(followHome ? plan.home.total : day.total) };
  const gymSkipped = day.kind === "gym" &&
    rows.some((r) => r.counted && slotOf(r.meal) === "gym" && r.state?.status === "skipped");
  if (gymSkipped) goal.kcal -= plan.target.gym - plan.target.rest;

  const counted = rows.filter((r) => r.counted);
  const done = counted.filter((r) => r.state?.status === "ate");
  const eaten = { kcal: sum(done, (r) => r.kcal), protein: sum(done, (r) => r.protein) };
  const open = counted.filter((r) => r.state === null);

  const gap = goal.kcal - eaten.kcal - sum(open, (r) => r.kcal);
  const proteinGap = goal.protein - eaten.protein - sum(open, (r) => r.protein);
  const picked = gap > DAY_TOLERANCE_KCAL ? bestChanges(open, gap, proteinGap, 1)
    : gap < -DAY_TOLERANCE_KCAL ? bestChanges(open, gap, proteinGap, -1)
    : [];
  for (const { row, change } of picked) {
    row.changes.push(change);
    row.kcal += change.kcal;
    row.protein += change.protein;
  }
  const moved = sum(picked, (p) => p.change.kcal);
  const movedProtein = sum(picked, (p) => p.change.protein);

  return {
    rows,
    goal,
    eaten,
    projected: { kcal: goal.kcal - gap + moved, protein: goal.protein - proteinGap + movedProtein },
    followHome,
    gymSkipped,
    moved,
  };
}

type Candidate = { row: DayRow; change: Change };

/**
 * The open meals' changes that bring the day back to its goal: add-ons when it is short (`way`
 * 1), trims when it is over (−1). Every combination is tried — one choice or none per meal and
 * group, a few thousand at most. None may carry the day more than the leeway past its goal (add-ons
 * over it, trims under it), and of the rest the best wins, judged in this order:
 *   1. how far outside the 50 kcal leeway the day still ends;
 *   2. protein: short of the plan after add-ons, or lost to trims;
 *   3. fewer changes;
 *   4. trims that cost the least (the 3ü1 and the oil before the rice, the soup last);
 *   5. closer to the goal.
 */
function bestChanges(open: DayRow[], gap: number, proteinGap: number, way: 1 | -1): Candidate[] {
  const slots: Candidate[][] = [];
  for (const row of open) {
    const groups = new Map<string, Candidate[]>();
    for (const change of mealOptions(row.meal)) {
      if (Math.sign(change.kcal) !== way) continue;
      groups.set(change.group, [...(groups.get(change.group) ?? []), { row, change }]);
    }
    slots.push(...groups.values());
  }

  const score = (chosen: Candidate[]) => {
    const kcal = sum(chosen, (p) => p.change.kcal);
    const protein = sum(chosen, (p) => p.change.protein);
    const after = gap - kcal;
    return [
      Math.max(0, Math.abs(after) - DAY_TOLERANCE_KCAL),
      way > 0 ? Math.max(0, proteinGap - protein) : -protein,
      chosen.length,
      sum(chosen, (p) => p.change.priority),
      Math.abs(after),
    ];
  };
  const better = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };

  let best: Candidate[] = [];
  let bestScore = score(best);
  const chosen: Candidate[] = [];
  const walk = (i: number) => {
    if (i === slots.length) {
      const after = gap - sum(chosen, (p) => p.change.kcal);
      if (way * after < -DAY_TOLERANCE_KCAL) return;
      const s = score(chosen);
      if (better(s, bestScore)) {
        best = [...chosen];
        bestScore = s;
      }
      return;
    }
    walk(i + 1);
    for (const pick of slots[i]) {
      chosen.push(pick);
      walk(i + 1);
      chosen.pop();
    }
  };
  walk(0);
  return best;
}

/** kcal and protein of the meals eaten, with what was eaten on top. */
export function eaten(day: MealDay, plan: Pick<MealPlan, "home" | "target">, states: MealStates) {
  return balanceDay(day, plan, states).eaten;
}

/** Extras as stored (JSON): anything not shaped like one is dropped rather than trusted. */
export function parseExtras(json: unknown): MealExtra[] {
  if (!Array.isArray(json)) return [];
  return json.filter((e): e is MealExtra =>
    typeof e === "object" && e !== null &&
    typeof e.label === "string" && Number.isInteger(e.kcal) && Number.isInteger(e.protein)
  ).map((e) => ({ label: e.label, kcal: e.kcal, protein: e.protein }));
}

/** A tick from before there were choices: every meal named was eaten as planned. */
export function statesFromChecked(checked: readonly string[]): MealStates {
  return Object.fromEntries(checked.map((key) => [key, { status: "ate" as const, changes: [], extras: [] }]));
}

/** The meals eaten, by key: what the old tick-only readers (the phone widgets) know as "checked". */
export const checkedOf = (states: MealStates): string[] =>
  Object.entries(states).filter(([, s]) => s.status === "ate").map(([key]) => key);
