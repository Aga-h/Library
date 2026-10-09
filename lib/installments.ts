// Installment purchases (taksit): a price paid over a fixed number of months — like a subscription
// that ends by itself. The total is what is stored; each month's share is derived here, to the
// kuruş, so the installments always add up to exactly the price.
//
// Pure — no database — so it is tested directly (scripts/test-installments.mjs) and safe to import
// in client components.

export const MIN_INSTALLMENTS = 2;
export const MAX_INSTALLMENTS = 60;

export interface InstallmentPlan {
  total: number;
  count: number;
  startYear: number;
  startMonth: number;
}

export interface YearMonth {
  year: number;
  month: number;
}

/** Months counted from year 0, so the distance between two months is a subtraction. */
function monthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

export function addMonths(year: number, month: number, n: number): YearMonth {
  const i = monthIndex(year, month) + n;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

/**
 * Every installment's amount, in order: the price split evenly to the kuruş, with what doesn't
 * divide added to the first one — as banks do. 1.000 ₺ in 3 is 333,34 + 333,33 + 333,33.
 */
export function installmentAmounts(total: number, count: number): number[] {
  const cents = Math.round(total * 100);
  const each = Math.floor(cents / count);
  const first = cents - each * (count - 1);
  return Array.from({ length: count }, (_, i) => (i === 0 ? first : each) / 100);
}

/** The price for "N installments of X" — what the per-installment amount adds up to. */
export function totalFromEach(each: number, count: number): number {
  return (Math.round(each * 100) * count) / 100;
}

/** The month of the last installment. */
export function lastMonth(plan: InstallmentPlan): YearMonth {
  return addMonths(plan.startYear, plan.startMonth, plan.count - 1);
}

/** Every installment with its month, first to last. */
export function schedule(plan: InstallmentPlan): (YearMonth & { number: number; amount: number })[] {
  return installmentAmounts(plan.total, plan.count).map((amount, i) => ({
    ...addMonths(plan.startYear, plan.startMonth, i),
    number: i + 1,
    amount,
  }));
}

/** The installment due in a month — its number (1-based) and amount — or null if none is. */
export function installmentInMonth(
  plan: InstallmentPlan,
  year: number,
  month: number
): { number: number; amount: number } | null {
  const k = monthIndex(year, month) - monthIndex(plan.startYear, plan.startMonth);
  if (k < 0 || k >= plan.count) return null;
  return { number: k + 1, amount: installmentAmounts(plan.total, plan.count)[k] };
}

export interface PlanState {
  /** upcoming: the first installment is later. paying: one is due this month. done: all paid. */
  phase: "upcoming" | "paying" | "done";
  /** This month's installment, while paying. */
  current: { number: number; amount: number } | null;
  /** Installments paid by the end of this month, and what they came to. */
  paidCount: number;
  paid: number;
  /** What is still to pay after this month. */
  left: number;
}

/** Where a plan stands as of a month — counting that month's installment as paid. */
export function planState(plan: InstallmentPlan, year: number, month: number): PlanState {
  const amounts = installmentAmounts(plan.total, plan.count);
  const k = monthIndex(year, month) - monthIndex(plan.startYear, plan.startMonth);
  const paidCount = Math.max(0, Math.min(plan.count, k + 1));
  const paidCents = amounts.slice(0, paidCount).reduce((s, a) => s + Math.round(a * 100), 0);
  const totalCents = Math.round(plan.total * 100);
  return {
    phase: k < 0 ? "upcoming" : k < plan.count ? "paying" : "done",
    current: k >= 0 && k < plan.count ? { number: k + 1, amount: amounts[k] } : null,
    paidCount,
    paid: paidCents / 100,
    left: (totalCents - paidCents) / 100,
  };
}

/** This month's installments as charges on their cards — next to expenses and subscriptions. */
export function chargesInMonth<S>(
  plans: readonly (InstallmentPlan & { source: S })[],
  year: number,
  month: number
): { amount: number; source: S }[] {
  return plans.flatMap((p) => {
    const due = installmentInMonth(p, year, month);
    return due ? [{ amount: due.amount, source: p.source }] : [];
  });
}
