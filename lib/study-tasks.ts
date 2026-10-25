// Study planner rules: which list a task belongs in, how it sorts, and what a save is allowed
// to say. No database and no React — the page, the API and the tests all share this file.
//
// Dates are Istanbul keys from lib/dates.ts. A due time is "HH:MM" on that date, compared to
// clockKey, so a task due today at 09:00 becomes overdue at 09:01 there and not before.

import { addDays, dayOfWeek, fromKey, isDateKey, todayKey, weekStartOf, type DateKey } from "@/lib/dates";

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_VIEWS = ["today", "upcoming", "overdue", "all", "none", "completed"] as const;
/** "day" is a date picked on the week strip, not one of the chips. */
export type TaskView = (typeof TASK_VIEWS)[number] | "day";

export const TASK_SORTS = ["deadline", "priority", "created", "alpha"] as const;
export type TaskSort = (typeof TASK_SORTS)[number];

export const TASK_COLORS = ["sky", "cyan", "teal", "violet", "amber", "orange", "rose", "slate"] as const;
export type TaskColor = (typeof TASK_COLORS)[number];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export const TASK_COLOR_LABEL: Record<TaskColor, string> = {
  sky: "Blue",
  cyan: "Cyan",
  teal: "Teal",
  violet: "Violet",
  amber: "Amber",
  orange: "Orange",
  rose: "Rose",
  slate: "Slate",
};

/** Full class strings so Tailwind keeps them. A stored color outside this list falls back to slate. */
export const TASK_COLOR_CLASS: Record<TaskColor, { dot: string; chip: string; swatch: string }> = {
  sky: { dot: "bg-sky-500", chip: "bg-sky-50 text-sky-800", swatch: "bg-sky-400" },
  cyan: { dot: "bg-cyan-500", chip: "bg-cyan-50 text-cyan-800", swatch: "bg-cyan-400" },
  teal: { dot: "bg-teal-500", chip: "bg-teal-50 text-teal-800", swatch: "bg-teal-400" },
  violet: { dot: "bg-violet-500", chip: "bg-violet-50 text-violet-800", swatch: "bg-violet-400" },
  amber: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800", swatch: "bg-amber-400" },
  orange: { dot: "bg-orange-500", chip: "bg-orange-50 text-orange-800", swatch: "bg-orange-400" },
  rose: { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-800", swatch: "bg-rose-400" },
  slate: { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700", swatch: "bg-slate-400" },
};

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  LOW: "bg-gray-300",
  MEDIUM: "bg-sky-400",
  HIGH: "bg-amber-500",
  URGENT: "bg-orange-500",
};

const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export const DEFAULT_CATEGORIES: { id: string; name: string; color: TaskColor; position: number }[] = [
  { id: "cat_homework", name: "Homework", color: "sky", position: 0 },
  { id: "cat_exam", name: "Exam Preparation", color: "orange", position: 1 },
  { id: "cat_revision", name: "Revision", color: "violet", position: 2 },
  { id: "cat_assignments", name: "Assignments", color: "amber", position: 3 },
  { id: "cat_reading", name: "Reading", color: "teal", position: 4 },
  { id: "cat_projects", name: "Projects", color: "cyan", position: 5 },
  { id: "cat_other", name: "Other", color: "slate", position: 6 },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface StudySubtask {
  id: string;
  title: string;
  done: boolean;
  position: number;
}

export interface StudyTask {
  id: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  categoryId: string | null;
  /** Istanbul date key, or null when the task has no deadline. */
  dueDate: string | null;
  /** "HH:MM", or null. Never set without a due date. */
  dueTime: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  createdAt: string;
  completedAt: string | null;
  subtasks: StudySubtask[];
}

export interface StudyLabel {
  id: string;
  name: string;
  color: string | null;
  position: number;
}

export interface TaskListQuery {
  view: TaskView;
  /** Used when view is "day". */
  day: string | null;
  /** null is every subject. "none" is tasks with no subject. Otherwise an id. */
  subjectId: string | null;
  categoryId: string | null;
  priority: TaskPriority | null;
  /**
   * "open" is everything not completed. A status narrows to that one. null keeps every status.
   * The Done view ignores it — that view is already the status.
   */
  status: "open" | TaskStatus | null;
  tag: string | null;
  search: string;
  sort: TaskSort;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface LabelRef {
  id: string | null;
  name: string | null;
  color: TaskColor | null;
}

export interface TaskWrite {
  title: string;
  description: string | null;
  dueDate: DateKey | null;
  dueTime: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  subtasks: { id?: string; title: string; done: boolean }[];
  subject: LabelRef | null;
  category: LabelRef | null;
}

export interface TaskPatch {
  title?: string;
  description?: string | null;
  dueDate?: DateKey | null;
  dueTime?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  tags?: string[];
  subtasks?: { id?: string; title: string; done: boolean }[];
  subtask?: { id: string; done: boolean };
  subject?: LabelRef;
  category?: LabelRef;
}

export function isTaskColor(value: unknown): value is TaskColor {
  return typeof value === "string" && (TASK_COLORS as readonly string[]).includes(value);
}

export function colorClass(color: string | null): { dot: string; chip: string; swatch: string } {
  if (color && isTaskColor(color)) return TASK_COLOR_CLASS[color];
  return TASK_COLOR_CLASS.slate;
}

/** The least-used palette color, so a new subject doesn't land on the same chip as its neighbour. */
export function nextColor(used: readonly (string | null)[]): TaskColor {
  let best: TaskColor = TASK_COLORS[0];
  let bestN = Infinity;
  for (const color of TASK_COLORS) {
    const n = used.filter((c) => c === color).length;
    if (n < bestN) {
      best = color;
      bestN = n;
    }
  }
  return best;
}

export function formatDay(key: DateKey): string {
  const d = fromKey(key);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function weekdayShort(key: DateKey): string {
  return WEEKDAYS[dayOfWeek(key)];
}

export function dayOfMonth(key: DateKey): number {
  return fromKey(key).getUTCDate();
}

/** "22–28 Oct", or "29 Sep – 5 Oct" when the week crosses a month. */
export function formatWeek(start: DateKey): string {
  const end = addDays(start, 6);
  const [s, e] = [fromKey(start), fromKey(end)];
  const sm = MONTHS[s.getUTCMonth()];
  const em = MONTHS[e.getUTCMonth()];
  return sm === em
    ? `${s.getUTCDate()}–${e.getUTCDate()} ${em}`
    : `${s.getUTCDate()} ${sm} – ${e.getUTCDate()} ${em}`;
}

export function weekDays(start: DateKey): DateKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Whole days from `from` to `to`. Positive when `to` is later. */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / 86_400_000);
}

export function formatInstantDay(iso: string): string {
  return formatDay(todayKey(new Date(iso)));
}

/**
 * The deadline has passed and the task is still open. A date with no time lasts the whole
 * Istanbul day. A time on that day passes at that minute — 09:00 is not overdue at 09:00.
 */
export function isOverdue(task: Pick<StudyTask, "status" | "dueDate" | "dueTime">, today: DateKey, clock: string): boolean {
  if (task.status === "COMPLETED" || !task.dueDate) return false;
  if (task.dueDate < today) return true;
  if (task.dueDate > today) return false;
  if (!task.dueTime) return false;
  return task.dueTime < clock;
}

/** Tomorrow through the seventh day from today, inclusive. Today has its own view. */
export function isUpcoming(task: Pick<StudyTask, "dueDate">, today: DateKey): boolean {
  if (!task.dueDate) return false;
  return task.dueDate > today && task.dueDate <= addDays(today, 7);
}

export function deadlineLabel(task: Pick<StudyTask, "status" | "dueDate" | "dueTime">, today: DateKey, clock: string): string {
  if (!task.dueDate || !isDateKey(task.dueDate)) return "No date";
  const time = task.dueTime ? ` ${task.dueTime}` : "";
  if (isOverdue(task, today, clock)) {
    if (task.dueDate === today) return `Overdue${time}`;
    const late = daysBetween(task.dueDate, today);
    return late === 1 ? `Overdue · 1 day${time}` : `Overdue · ${late} days${time}`;
  }
  if (task.dueDate === today) return `Today${time}`;
  if (task.dueDate === addDays(today, 1)) return `Tomorrow${time}`;
  return `${formatDay(task.dueDate)}${time}`;
}

export type DeadlineTone = "overdue" | "today" | "soon" | "later" | "none";

export function deadlineTone(task: Pick<StudyTask, "status" | "dueDate" | "dueTime">, today: DateKey, clock: string): DeadlineTone {
  if (!task.dueDate) return "none";
  if (isOverdue(task, today, clock)) return "overdue";
  if (task.dueDate === today) return "today";
  if (task.dueDate === addDays(today, 1)) return "soon";
  return "later";
}

function matchesView(task: StudyTask, query: TaskListQuery, today: DateKey, clock: string): boolean {
  switch (query.view) {
    case "today":
      return task.dueDate === today;
    case "upcoming":
      return isUpcoming(task, today);
    case "overdue":
      return isOverdue(task, today, clock);
    case "all":
      return true;
    case "none":
      return task.dueDate === null;
    case "completed":
      return task.status === "COMPLETED";
    case "day":
      return query.day != null && task.dueDate === query.day;
    default:
      return false;
  }
}

function matchesId(actual: string | null, filter: string | null): boolean {
  if (filter == null || filter === "") return true;
  if (filter === "none") return actual == null;
  return actual === filter;
}

function fold(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function taskMatches(task: StudyTask, query: TaskListQuery, today: DateKey, clock: string): boolean {
  if (!matchesView(task, query, today, clock)) return false;
  if (!matchesId(task.subjectId, query.subjectId)) return false;
  if (!matchesId(task.categoryId, query.categoryId)) return false;
  if (query.priority && task.priority !== query.priority) return false;
  if (query.tag && !task.tags.some((tag) => tag.toLowerCase() === query.tag!.toLowerCase())) return false;
  const needle = fold(query.search);
  if (needle) {
    const hay = fold(`${task.title}\n${task.description ?? ""}`);
    if (!hay.includes(needle)) return false;
  }
  if (query.view !== "completed" && query.status) {
    if (query.status === "open") {
      if (task.status === "COMPLETED") return false;
    } else if (task.status !== query.status) {
      return false;
    }
  }
  return true;
}

function titleCmp(a: StudyTask, b: StudyTask): number {
  return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
}

function deadlineCmp(a: StudyTask, b: StudyTask): number {
  const da = a.dueDate ?? "9999-99-99";
  const db = b.dueDate ?? "9999-99-99";
  if (da !== db) return da < db ? -1 : 1;
  // A time is earlier than "sometime that day", so timed tasks come first.
  const ta = a.dueDate ? (a.dueTime ?? "99:99") : "";
  const tb = b.dueDate ? (b.dueTime ?? "99:99") : "";
  if (ta !== tb) return ta < tb ? -1 : 1;
  return 0;
}

export function sortTasks(tasks: readonly StudyTask[], sort: TaskSort): StudyTask[] {
  const copy = [...tasks];
  copy.sort((a, b) => {
    switch (sort) {
      case "priority":
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || deadlineCmp(a, b) || titleCmp(a, b);
      case "created":
        return (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0) || titleCmp(a, b);
      case "alpha":
        return titleCmp(a, b) || deadlineCmp(a, b);
      default:
        return deadlineCmp(a, b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || titleCmp(a, b);
    }
  });
  return copy;
}

export function applyTaskQuery(tasks: readonly StudyTask[], query: TaskListQuery, today: DateKey, clock: string): StudyTask[] {
  return sortTasks(tasks.filter((task) => taskMatches(task, query, today, clock)), query.sort);
}

export function listProgress(tasks: readonly StudyTask[]): { done: number; total: number; fraction: number } {
  const total = tasks.length;
  const done = tasks.reduce((n, task) => n + (task.status === "COMPLETED" ? 1 : 0), 0);
  return { done, total, fraction: total === 0 ? 0 : done / total };
}

export function plannerOverview(tasks: readonly StudyTask[], today: DateKey, clock: string) {
  const start = weekStartOf(today);
  const end = addDays(start, 6);
  let dueToday = 0;
  let remaining = 0;
  let overdue = 0;
  let completedThisWeek = 0;
  for (const task of tasks) {
    if (task.status === "COMPLETED") {
      if (task.completedAt) {
        const day = todayKey(new Date(task.completedAt));
        if (day >= start && day <= end) completedThisWeek++;
      }
      continue;
    }
    remaining++;
    if (task.dueDate === today) dueToday++;
    if (isOverdue(task, today, clock)) overdue++;
  }
  return { dueToday, remaining, overdue, completedThisWeek };
}

/** Open tasks on a date — the count on the week strip. */
export function openCountOn(tasks: readonly StudyTask[], day: DateKey): number {
  let n = 0;
  for (const task of tasks) {
    if (task.status !== "COMPLETED" && task.dueDate === day) n++;
  }
  return n;
}

export function countOpenBy(tasks: readonly StudyTask[], key: "subjectId" | "categoryId"): Map<string | null, number> {
  const map = new Map<string | null, number>();
  for (const task of tasks) {
    if (task.status === "COMPLETED") continue;
    const id = task[key];
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

export function defaultDueDate(view: TaskView, day: string | null, today: DateKey): string {
  if (view === "today") return today;
  if (view === "day" && day && isDateKey(day)) return day;
  if (view === "upcoming") return addDays(today, 1);
  return "";
}

export function emptyCopy(query: TaskListQuery): string {
  const narrowed = Boolean(
    query.subjectId || query.categoryId || query.priority || query.tag || query.search.trim()
    || (query.status && query.status !== "open"),
  );
  if (narrowed) return "No tasks match.";
  switch (query.view) {
    case "today":
      return "Nothing due today.";
    case "upcoming":
      return "Nothing due in the next 7 days.";
    case "overdue":
      return "Nothing overdue.";
    case "none":
      return "Every task has a date.";
    case "completed":
      return "No finished tasks yet.";
    case "day":
      return query.day && isDateKey(query.day) ? `Nothing on ${formatDay(query.day)}.` : "Nothing on that day.";
    default:
      return "No tasks yet.";
  }
}

/**
 * Completion is recorded once, the moment the task becomes completed, and cleared the moment
 * it leaves. Saving a task that is already done does not move the timestamp.
 */
export function nextCompletedAt(
  current: { status: TaskStatus; completedAt: string | null },
  status: TaskStatus,
  nowIso: string,
): string | null {
  if (status !== "COMPLETED") return null;
  if (current.status === "COMPLETED" && current.completedAt) return current.completedAt;
  return nowIso;
}

/**
 * A time cannot exist without a date. Clearing the date clears the time. Setting a time when
 * the task still has no date is refused, rather than inventing a day.
 */
export function nextDeadline(
  current: { dueDate: string | null; dueTime: string | null },
  patch: { dueDate?: string | null; dueTime?: string | null },
): { dueDate: string | null; dueTime: string | null } | { error: string } {
  const dueDate = patch.dueDate !== undefined ? patch.dueDate : current.dueDate;
  const dueTime = patch.dueTime !== undefined ? patch.dueTime : current.dueTime;
  if (!dueDate) {
    if (patch.dueTime && patch.dueDate === undefined) return { error: "A time needs a date" };
    return { dueDate: null, dueTime: null };
  }
  return { dueDate, dueTime };
}

export function normalizeTags(raw: readonly string[]): string[] | { error: string } {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const tag = item.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    if (tag.length > 32) return { error: "A tag can be at most 32 characters" };
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  if (out.length > 12) return { error: "At most 12 tags" };
  return out;
}

export function normalizeLabelName(value: string): string | { error: string } {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return { error: "A name is required" };
  if (name.length > 60) return { error: "A name can be at most 60 characters" };
  return name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDate(value: unknown): ParseResult<DateKey | null> {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value !== "string" || !isDateKey(value)) return { ok: false, error: "That date isn't valid" };
  return { ok: true, value };
}

function readTime(value: unknown): ParseResult<string | null> {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "Time must be HH:MM" };
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value.trim());
  if (!match) return { ok: false, error: "Time must be HH:MM" };
  return { ok: true, value: `${match[1]}:${match[2]}` };
}

function readTitle(value: unknown): ParseResult<string> {
  if (typeof value !== "string") return { ok: false, error: "A task needs a title" };
  const title = value.trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, error: "A task needs a title" };
  if (title.length > 200) return { ok: false, error: "A title can be at most 200 characters" };
  return { ok: true, value: title };
}

function readDescription(value: unknown): ParseResult<string | null> {
  if (value == null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "Description has to be text" };
  const text = value.trim();
  if (!text) return { ok: true, value: null };
  if (text.length > 4000) return { ok: false, error: "Description can be at most 4000 characters" };
  return { ok: true, value: text };
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): ParseResult<T> {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    return { ok: false, error: `${label} isn't one of the choices` };
  }
  return { ok: true, value: value as T };
}

function readTags(value: unknown): ParseResult<string[]> {
  if (value == null) return { ok: true, value: [] };
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
    return { ok: false, error: "Tags have to be text" };
  }
  const tags = normalizeTags(value);
  if ("error" in tags) return { ok: false, error: tags.error };
  return { ok: true, value: tags };
}

function readSubtasks(value: unknown): ParseResult<{ id?: string; title: string; done: boolean }[]> {
  if (value == null) return { ok: true, value: [] };
  if (!Array.isArray(value)) return { ok: false, error: "Steps have to be a list" };
  const out: { id?: string; title: string; done: boolean }[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "A step is missing its name" };
    const title = typeof item.title === "string" ? item.title.trim().replace(/\s+/g, " ") : "";
    if (!title) continue;
    if (title.length > 200) return { ok: false, error: "A step can be at most 200 characters" };
    if (typeof item.done !== "boolean") return { ok: false, error: "A step needs to say whether it is done" };
    let id: string | undefined;
    if (item.id != null) {
      if (typeof item.id !== "string" || item.id.trim() === "" || item.id.length > 80) {
        return { ok: false, error: "That step isn't valid" };
      }
      id = item.id;
      if (seen.has(id)) return { ok: false, error: "A step was listed twice" };
      seen.add(id);
    }
    out.push(id ? { id, title, done: item.done } : { title, done: item.done });
  }
  if (out.length > 40) return { ok: false, error: "At most 40 steps" };
  return { ok: true, value: out };
}

function readColor(value: unknown): ParseResult<TaskColor | null> {
  if (value == null || value === "") return { ok: true, value: null };
  if (!isTaskColor(value)) return { ok: false, error: "Pick a color from the list" };
  return { ok: true, value };
}

function readLabel(body: Record<string, unknown>, prefix: "subject" | "category", requiredKeys: boolean): ParseResult<LabelRef | null> {
  const idKey = `${prefix}Id`;
  const nameKey = `${prefix}Name`;
  const colorKey = `${prefix}Color`;
  if (!requiredKeys && !(idKey in body) && !(nameKey in body) && !(colorKey in body)) {
    return { ok: true, value: null };
  }
  let name: string | null = null;
  if (nameKey in body && body[nameKey] != null && body[nameKey] !== "") {
    if (typeof body[nameKey] !== "string") return { ok: false, error: "A name is required" };
    const parsed = normalizeLabelName(body[nameKey]);
    if (typeof parsed !== "string") return { ok: false, error: parsed.error };
    name = parsed;
  }
  let id: string | null = null;
  if (idKey in body && body[idKey] != null && body[idKey] !== "") {
    if (typeof body[idKey] !== "string" || body[idKey].length > 80) {
      return { ok: false, error: prefix === "subject" ? "Subject not found" : "Category not found" };
    }
    id = body[idKey];
  }
  const color = colorKey in body ? readColor(body[colorKey]) : { ok: true as const, value: null };
  if (!color.ok) return color;
  if (!name && !id) return { ok: true, value: null };
  return { ok: true, value: { id, name, color: color.value } };
}

export function parseTaskCreate(body: unknown): ParseResult<TaskWrite> {
  if (!isRecord(body)) return { ok: false, error: "Validation failed" };
  const title = readTitle(body.title);
  if (!title.ok) return title;
  const description = "description" in body ? readDescription(body.description) : { ok: true as const, value: null };
  if (!description.ok) return description;
  const dueDate = "dueDate" in body ? readDate(body.dueDate) : { ok: true as const, value: null };
  if (!dueDate.ok) return dueDate;
  const dueTime = "dueTime" in body ? readTime(body.dueTime) : { ok: true as const, value: null };
  if (!dueTime.ok) return dueTime;
  if (dueTime.value && !dueDate.value) return { ok: false, error: "A time needs a date" };
  const priority = "priority" in body && body.priority != null
    ? readEnum(body.priority, TASK_PRIORITIES, "Priority")
    : { ok: true as const, value: "MEDIUM" as const };
  if (!priority.ok) return priority;
  const status = "status" in body && body.status != null
    ? readEnum(body.status, TASK_STATUSES, "Status")
    : { ok: true as const, value: "NOT_STARTED" as const };
  if (!status.ok) return status;
  const tags = "tags" in body ? readTags(body.tags) : { ok: true as const, value: [] as string[] };
  if (!tags.ok) return tags;
  const subtasks = "subtasks" in body ? readSubtasks(body.subtasks) : { ok: true as const, value: [] };
  if (!subtasks.ok) return subtasks;
  const subject = readLabel(body, "subject", false);
  if (!subject.ok) return subject;
  const category = readLabel(body, "category", false);
  if (!category.ok) return category;
  return {
    ok: true,
    value: {
      title: title.value,
      description: description.value,
      dueDate: dueDate.value,
      dueTime: dueTime.value,
      priority: priority.value,
      status: status.value,
      tags: tags.value,
      subtasks: subtasks.value,
      subject: subject.value,
      category: category.value,
    },
  };
}

export function parseTaskPatch(body: unknown): ParseResult<TaskPatch> {
  if (!isRecord(body)) return { ok: false, error: "Validation failed" };
  const patch: TaskPatch = {};
  if ("title" in body) {
    const title = readTitle(body.title);
    if (!title.ok) return title;
    patch.title = title.value;
  }
  if ("description" in body) {
    const description = readDescription(body.description);
    if (!description.ok) return description;
    patch.description = description.value;
  }
  if ("dueDate" in body) {
    const dueDate = readDate(body.dueDate);
    if (!dueDate.ok) return dueDate;
    patch.dueDate = dueDate.value;
  }
  if ("dueTime" in body) {
    const dueTime = readTime(body.dueTime);
    if (!dueTime.ok) return dueTime;
    patch.dueTime = dueTime.value;
  }
  if (patch.dueTime && patch.dueDate === null) {
    // The date is being cleared in the same save, which drops the time. Don't refuse it.
    patch.dueTime = null;
  }
  if ("priority" in body) {
    const priority = readEnum(body.priority, TASK_PRIORITIES, "Priority");
    if (!priority.ok) return priority;
    patch.priority = priority.value;
  }
  if ("status" in body) {
    const status = readEnum(body.status, TASK_STATUSES, "Status");
    if (!status.ok) return status;
    patch.status = status.value;
  }
  if ("tags" in body) {
    const tags = readTags(body.tags);
    if (!tags.ok) return tags;
    patch.tags = tags.value;
  }
  if ("subtasks" in body && "subtask" in body) {
    return { ok: false, error: "Update the steps one way at a time" };
  }
  if ("subtasks" in body) {
    const subtasks = readSubtasks(body.subtasks);
    if (!subtasks.ok) return subtasks;
    patch.subtasks = subtasks.value;
  }
  if ("subtask" in body) {
    const raw = body.subtask;
    if (!isRecord(raw) || typeof raw.id !== "string" || raw.id.trim() === "" || raw.id.length > 80 || typeof raw.done !== "boolean") {
      return { ok: false, error: "That step isn't valid" };
    }
    patch.subtask = { id: raw.id, done: raw.done };
  }
  if ("subjectId" in body || "subjectName" in body || "subjectColor" in body) {
    const subject = readLabel(body, "subject", true);
    if (!subject.ok) return subject;
    patch.subject = subject.value ?? { id: null, name: null, color: null };
  }
  if ("categoryId" in body || "categoryName" in body || "categoryColor" in body) {
    const category = readLabel(body, "category", true);
    if (!category.ok) return category;
    patch.category = category.value ?? { id: null, name: null, color: null };
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to change" };
  return { ok: true, value: patch };
}

export function parseLabelCreate(body: unknown): ParseResult<{ name: string; color: TaskColor | null }> {
  if (!isRecord(body)) return { ok: false, error: "Validation failed" };
  if (typeof body.name !== "string") return { ok: false, error: "A name is required" };
  const name = normalizeLabelName(body.name);
  if (typeof name !== "string") return { ok: false, error: name.error };
  const color = "color" in body ? readColor(body.color) : { ok: true as const, value: null };
  if (!color.ok) return color;
  return { ok: true, value: { name, color: color.value } };
}

export function parseLabelPatch(body: unknown): ParseResult<{ name?: string; color?: TaskColor | null }> {
  if (!isRecord(body)) return { ok: false, error: "Validation failed" };
  const patch: { name?: string; color?: TaskColor | null } = {};
  if ("name" in body) {
    if (typeof body.name !== "string") return { ok: false, error: "A name is required" };
    const name = normalizeLabelName(body.name);
    if (typeof name !== "string") return { ok: false, error: name.error };
    patch.name = name;
  }
  if ("color" in body) {
    const color = readColor(body.color);
    if (!color.ok) return color;
    patch.color = color.value;
  }
  if (patch.name === undefined && patch.color === undefined) return { ok: false, error: "Nothing to change" };
  return { ok: true, value: patch };
}
