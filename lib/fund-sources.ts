// Where money comes from. Two pots, like two cards: BASE is the monthly budget, EXTRA is
// additional income. Every expense and subscription is paid from one of them, and each pot carries
// over from month to month on its own — so "how much is left" can be answered per card.
//
// Pure — no database — so it is tested directly (scripts/test-finances.mjs) and safe to import in
// client components.

export const FUND_SOURCES = ["BASE", "EXTRA"] as const;
export type FundSource = (typeof FUND_SOURCES)[number];

export const SOURCE_LABELS: Record<FundSource, string> = { BASE: "Base", EXTRA: "Extra" };

export function isFundSource(v: unknown): v is FundSource {
  return v === "BASE" || v === "EXTRA";
}

export interface SourceSplit {
  base: number;
  extra: number;
}

/** One month of history: the additional income that came in, and what each pot paid for. */
export interface MonthFlow {
  income: number;
  spent: Record<FundSource, number>;
}

export function emptyFlow(): MonthFlow {
  return { income: 0, spent: { BASE: 0, EXTRA: 0 } };
}

/**
 * Carries both pots through the months before the one shown, oldest first: the base pot gets the
 * budget and pays for what was charged to it; the extra pot gets the additional income and pays
 * for the rest. Their sum is exactly the single carryover the page showed before sources existed —
 * including its rule that only a month with something recorded in it receives the budget.
 */
export function rollCarryover(months: readonly MonthFlow[], budget: number): SourceSplit {
  let base = 0;
  let extra = 0;
  for (const m of months) {
    base += budget - m.spent.BASE;
    extra += m.income - m.spent.EXTRA;
  }
  return { base, extra };
}

export interface PotBalance {
  /** What came into the pot this month: the budget, or the additional income. */
  incoming: number;
  /** What it carried over from earlier months (can be negative). */
  carried: number;
  spent: number;
  left: number;
}

export interface MonthBalances {
  base: PotBalance;
  extra: PotBalance;
  total: { available: number; spent: number; left: number };
}

/** This month's money, per pot: what came in, what was carried, what was spent, what is left. */
export function monthBalances(input: {
  budget: number;
  carryover: SourceSplit;
  income: number;
  /** Expenses and this month's active subscriptions alike. */
  charges: readonly { amount: number; source: FundSource }[];
}): MonthBalances {
  const spent = { BASE: 0, EXTRA: 0 };
  for (const c of input.charges) spent[c.source] += c.amount;
  const pot = (incoming: number, carried: number, s: number): PotBalance => ({
    incoming, carried, spent: s, left: incoming + carried - s,
  });
  const base = pot(input.budget, input.carryover.base, spent.BASE);
  const extra = pot(input.income, input.carryover.extra, spent.EXTRA);
  return {
    base,
    extra,
    total: {
      available: base.incoming + base.carried + extra.incoming + extra.carried,
      spent: base.spent + extra.spent,
      left: base.left + extra.left,
    },
  };
}

/**
 * What is left on each card once the expenses still waiting on this device are counted — the
 * server's figure doesn't include them yet. Only this month's queued expenses count against this
 * month's balance.
 */
export function leftAfterPending(
  left: SourceSplit,
  pending: readonly { amount: number; source?: FundSource; year: number; month: number }[],
  year: number,
  month: number
): SourceSplit {
  const out = { ...left };
  for (const p of pending) {
    if (p.year !== year || p.month !== month) continue;
    // Queued before sources existed: the server files those under Base.
    if ((p.source ?? "BASE") === "BASE") out.base -= p.amount;
    else out.extra -= p.amount;
  }
  return out;
}
