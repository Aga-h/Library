// Local-time helpers — every day key and clock label in the app is resolved in
// APP_TIMEZONE so the server and the browser always agree on what "today" is.

export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Europe/Istanbul";

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hour12: false,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

interface Zoned { year: number; month: number; day: number; hour: number; minute: number; second: number }

function zonedParts(date: Date): Zoned {
  const p: Record<string, string> = {};
  for (const { type, value } of PARTS.formatToParts(date)) p[type] = value;
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour) % 24, minute: Number(p.minute), second: Number(p.second),
  };
}

/** Milliseconds APP_TIMEZONE is ahead of UTC at the given instant. */
function offsetAt(date: Date): number {
  const z = zonedParts(date);
  return Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/** "YYYY-MM-DD" for the instant, in local time. */
export function dayKey(date: Date = new Date()): string {
  const z = zonedParts(date);
  return `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
}

export function todayKey(): string {
  return dayKey(new Date());
}

/** Turns a local day key + minutes-past-midnight into a real instant. */
export function localToDate(day: string, minutes: number): Date {
  const [y, mo, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, 0, minutes);
  const first = guess - offsetAt(new Date(guess));
  const second = guess - offsetAt(new Date(first));
  return new Date(second);
}

/** Minutes past local midnight for the instant. */
export function minutesOfDay(date: Date): number {
  const z = zonedParts(date);
  return z.hour * 60 + z.minute;
}

/** "HH:MM" in local time. */
export function clock(date: Date): string {
  const z = zonedParts(date);
  return `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
}

/** "HH:MM" from minutes past midnight — 1440 reads as 24:00, the end of the day. */
export function clockFromMinutes(minutes: number): string {
  if (minutes === 1440) return "24:00";
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function isDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function addDaysToKey(day: string, amount: number): string {
  const [y, mo, d] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, mo - 1, d + amount));
  return shifted.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(day: string): number {
  const [y, mo, d] = day.split("-").map(Number);
  return (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7;
}

export function startOfWeekKey(day: string): string {
  return addDaysToKey(day, -weekdayIndex(day));
}

export function weekKeys(anchor: string): string[] {
  const monday = startOfWeekKey(anchor);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i));
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function dayName(day: string, short = false): string {
  const name = DAY_NAMES[weekdayIndex(day)];
  return short ? name.slice(0, 3) : name;
}

export function monthName(day: string, short = false): string {
  const name = MONTH_NAMES[Number(day.split("-")[1]) - 1];
  return short ? name.slice(0, 3) : name;
}

export function dayNumber(day: string): number {
  return Number(day.split("-")[2]);
}

/** "Monday, 14 September" — stable between server and client. */
export function formatDayLong(day: string): string {
  return `${dayName(day)}, ${dayNumber(day)} ${monthName(day)}`;
}

export function formatDayShort(day: string): string {
  return `${dayNumber(day)} ${monthName(day, true)}`;
}

/** "2h 30m" / "45m" / "20s" */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

/** "01:23:45" — for the live session timer. */
export function formatStopwatch(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
