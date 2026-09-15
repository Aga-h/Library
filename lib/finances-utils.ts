export function compareMonths(y1: number, m1: number, y2: number, m2: number): number {
  if (y1 !== y2) return y1 - y2;
  return m1 - m2;
}

export function padKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function isSubscriptionActiveInMonth(
  sub: { startYear: number; startMonth: number; cancelledYear: number | null; cancelledMonth: number | null },
  year: number,
  month: number
): boolean {
  if (compareMonths(sub.startYear, sub.startMonth, year, month) > 0) return false;
  if (sub.cancelledYear != null && sub.cancelledMonth != null) {
    if (compareMonths(sub.cancelledYear, sub.cancelledMonth, year, month) <= 0) return false;
  }
  return true;
}
