// Study planner. A task has to land in the right list, an overdue flag has to follow Istanbul's
// clock, and a save has to refuse the shapes that would store a time with no date.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-study-tasks.mjs
import { readFileSync } from "node:fs";
import {
  DEFAULT_CATEGORIES, TASK_COLORS, applyTaskQuery, daysBetween, deadlineLabel, defaultDueDate,
  emptyCopy, isOverdue, isUpcoming, listProgress, nextColor, nextCompletedAt, nextDeadline,
  normalizeTags, openCountOn, parseLabelCreate, parseLabelPatch, parseTaskCreate, parseTaskPatch,
  plannerOverview, sortTasks, taskMatches,
} from "../lib/study-tasks.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

const TODAY = "2026-10-25"; // a Sunday, so the week is Mon 19 – Sun 25
const CLOCK = "15:00";

function task(over = {}) {
  return {
    id: over.id ?? "t",
    title: "Task",
    description: null,
    subjectId: null,
    categoryId: null,
    dueDate: null,
    dueTime: null,
    priority: "MEDIUM",
    status: "NOT_STARTED",
    tags: [],
    createdAt: "2026-10-20T09:00:00.000Z",
    completedAt: null,
    subtasks: [],
    ...over,
  };
}

const query = (over = {}) => ({
  view: "all",
  day: null,
  subjectId: null,
  categoryId: null,
  priority: null,
  status: null,
  tag: null,
  search: "",
  sort: "deadline",
  ...over,
});

// ── overdue follows the Istanbul clock, and a bare date lasts the whole day ──
ok(!isOverdue(task({ dueDate: TODAY, dueTime: "15:00" }), TODAY, CLOCK), "due at this minute is not overdue yet");
ok(isOverdue(task({ dueDate: TODAY, dueTime: "14:59" }), TODAY, CLOCK), "one minute past the time is overdue");
ok(!isOverdue(task({ dueDate: TODAY }), TODAY, "23:59"), "a date with no time lasts the whole day");
ok(isOverdue(task({ dueDate: "2026-10-24" }), TODAY, CLOCK), "yesterday is overdue");
ok(!isOverdue(task({ dueDate: "2026-10-26" }), TODAY, CLOCK), "tomorrow is not overdue");
ok(!isOverdue(task({ dueDate: "2026-10-24", status: "COMPLETED" }), TODAY, CLOCK), "a finished task is never overdue");
ok(!isOverdue(task(), TODAY, CLOCK), "no date is never overdue");

// ── the views do not overlap, except a task due today whose time has passed ──
const passed = task({ dueDate: TODAY, dueTime: "09:00" });
ok(taskMatches(passed, query({ view: "today" }), TODAY, CLOCK), "a lapsed time is still due today");
ok(taskMatches(passed, query({ view: "overdue" }), TODAY, CLOCK), "…and it is also overdue");
ok(!isUpcoming(passed, TODAY), "today is not upcoming");

const tomorrow = task({ dueDate: "2026-10-26" });
const edge = task({ dueDate: "2026-11-01" });
const beyond = task({ dueDate: "2026-11-02" });
ok(isUpcoming(tomorrow, TODAY) && isUpcoming(edge, TODAY), "upcoming is tomorrow through the seventh day");
ok(!isUpcoming(beyond, TODAY) && !isUpcoming(task({ dueDate: TODAY }), TODAY), "the day after that, and today, are not upcoming");
ok(!taskMatches(task(), query({ view: "today" }), TODAY, CLOCK), "no date is not today");
ok(taskMatches(task(), query({ view: "none" }), TODAY, CLOCK), "no date has its own view");
ok(taskMatches(task({ status: "COMPLETED", completedAt: "2026-10-25T10:00:00.000Z" }), query({ view: "completed" }), TODAY, CLOCK),
  "done is its own view");
ok(!taskMatches(task({ dueDate: "2026-10-20", status: "COMPLETED" }), query({ view: "overdue" }), TODAY, CLOCK),
  "a finished task with a past date is not in overdue");

// ── filters combine, and search stays on the title and the description ──────
const math = task({
  id: "math",
  title: "Problem set",
  description: "Chapter 4, integrals",
  subjectId: "maths",
  categoryId: "cat_exam",
  dueDate: "2026-10-27",
  priority: "HIGH",
  tags: ["calculus"],
});
const other = task({ id: "other", title: "Read notes", subjectId: "hist", dueDate: "2026-10-27", priority: "LOW", tags: ["mitochondria"] });
const list = [math, other];
const weekHigh = applyTaskQuery(list, query({
  view: "upcoming", subjectId: "maths", priority: "HIGH", search: "integrals",
}), TODAY, CLOCK);
eq(weekHigh.map((t) => t.id), ["math"], "high-priority mathematics, due this week, matching the notes");
eq(applyTaskQuery(list, query({ search: "mitochondria" }), TODAY, CLOCK).map((t) => t.id), [],
  "a tag is not a search hit");
eq(applyTaskQuery(list, query({ search: "  CHAPTER   4 " }), TODAY, CLOCK).map((t) => t.id), ["math"],
  "search ignores case and the shape of the gap");
eq(applyTaskQuery(list, query({ subjectId: "none" }), TODAY, CLOCK).map((t) => t.id), [],
  "none means tasks with no subject");
eq(applyTaskQuery([task({ id: "bare" })], query({ subjectId: "none" }), TODAY, CLOCK).map((t) => t.id), ["bare"],
  "a task with no subject is findable that way");
eq(applyTaskQuery(list, query({ view: "upcoming", status: "open" }), TODAY, CLOCK).map((t) => t.id).sort(), ["math", "other"],
  "open keeps both unfinished tasks due this week");
const doneMath = { ...math, status: "COMPLETED", completedAt: "2026-10-25T12:00:00.000Z" };
eq(applyTaskQuery([doneMath], query({ view: "upcoming", status: "open" }), TODAY, CLOCK), [],
  "open hides a finished task even when its date is in the view");
eq(applyTaskQuery([doneMath], query({ view: "completed", status: "NOT_STARTED" }), TODAY, CLOCK).map((t) => t.id), ["math"],
  "the done view ignores the status filter");

// ── sort ─────────────────────────────────────────────────────────────────────
const pile = [
  task({ id: "late", title: "b", dueDate: "2026-10-28", priority: "LOW", createdAt: "2026-10-01T00:00:00.000Z" }),
  task({ id: "early-time", title: "a", dueDate: "2026-10-26", dueTime: "09:00", priority: "URGENT", createdAt: "2026-10-02T00:00:00.000Z" }),
  task({ id: "early-day", title: "c", dueDate: "2026-10-26", priority: "HIGH", createdAt: "2026-10-03T00:00:00.000Z" }),
  task({ id: "none", title: "d", priority: "MEDIUM", createdAt: "2026-10-04T00:00:00.000Z" }),
];
eq(sortTasks(pile, "deadline").map((t) => t.id), ["early-time", "early-day", "late", "none"],
  "deadline: dated first, a time before a bare day, undated last");
eq(sortTasks(pile, "priority").map((t) => t.id), ["early-time", "early-day", "none", "late"],
  "priority: urgent, then high, then medium, then low");
eq(sortTasks(pile, "created").map((t) => t.id), ["none", "early-day", "early-time", "late"],
  "newest first");
eq(sortTasks(pile, "alpha").map((t) => t.id), ["early-time", "late", "early-day", "none"],
  "alphabetical, then deadline");
const frozen = [task({ title: "b" }), task({ title: "a" })];
sortTasks(frozen, "alpha");
eq(frozen.map((t) => t.title), ["b", "a"], "sorting does not reorder the list it was given");

// ── progress and the week, on Istanbul's dates ───────────────────────────────
const progressTasks = [
  task({ id: "open-today", dueDate: TODAY, dueTime: "09:00" }),
  task({ id: "open-old", dueDate: "2026-10-20" }),
  task({ id: "done-week", status: "COMPLETED", completedAt: "2026-10-18T21:30:00.000Z" }),
  task({ id: "done-before", status: "COMPLETED", completedAt: "2026-10-18T20:30:00.000Z" }),
  task({ id: "done-next", status: "COMPLETED", completedAt: "2026-10-25T21:30:00.000Z" }),
  task({ id: "no-date" }),
];
// 21:30 UTC on the 18th is 00:30 on the 19th in Istanbul — Monday, inside this week.
// 20:30 UTC is still the 18th there, last week. 21:30 UTC on the 25th is the 26th, next week.
eq(plannerOverview(progressTasks, TODAY, CLOCK), {
  dueToday: 1, remaining: 3, overdue: 2, completedThisWeek: 1,
}, "today's open task is also overdue; only the Monday completion counts this week");
eq(listProgress(applyTaskQuery(progressTasks, query({ view: "today", status: null }), TODAY, CLOCK)),
  { done: 0, total: 1, fraction: 0 }, "the bar for today counts every task due today");
eq(listProgress([task({ status: "COMPLETED" }), task({ status: "COMPLETED" }), task(), task()]),
  { done: 2, total: 4, fraction: 0.5 }, "half done is a half-full bar");
eq(listProgress([]), { done: 0, total: 0, fraction: 0 }, "an empty list does not divide by zero");
eq(openCountOn(progressTasks, TODAY), 1, "the week strip counts open tasks on that day");
eq(daysBetween("2026-10-20", TODAY), 5, "five days late");

// A week later, that Monday completion has left the week and Sunday night's has entered it.
eq(plannerOverview(progressTasks, "2026-10-26", "00:30").completedThisWeek, 1,
  "00:30 Monday belongs to the new week");

eq(deadlineLabel(task({ dueDate: TODAY, dueTime: "09:00" }), TODAY, CLOCK), "Overdue 09:00", "lapsed today");
eq(deadlineLabel(task({ dueDate: "2026-10-24", dueTime: "18:00" }), TODAY, CLOCK), "Overdue · 1 day 18:00", "yesterday");
eq(deadlineLabel(task({ dueDate: "2026-10-23" }), TODAY, CLOCK), "Overdue · 2 days", "two days ago");
eq(deadlineLabel(task({ dueDate: TODAY, dueTime: "18:00" }), TODAY, CLOCK), "Today 18:00", "still ahead today");
eq(deadlineLabel(task({ dueDate: "2026-10-26" }), TODAY, CLOCK), "Tomorrow", "tomorrow");
eq(deadlineLabel(task(), TODAY, CLOCK), "No date", "no date");
eq(defaultDueDate("today", null, TODAY), TODAY, "adding from today lands today");
eq(defaultDueDate("upcoming", null, TODAY), "2026-10-26", "adding from upcoming lands tomorrow");
eq(defaultDueDate("day", "2026-10-27", TODAY), "2026-10-27", "adding from a picked day uses that day");
eq(defaultDueDate("none", null, TODAY), "", "adding from no-date leaves the date empty");
eq(defaultDueDate("day", "nope", TODAY), "", "a bad picked day does not become a date");
eq(emptyCopy(query({ view: "today" })), "Nothing due today.", "empty today");
eq(emptyCopy(query({ view: "today", search: "x" })), "No tasks match.", "a search that misses says so");

// ── what a save is allowed to say ────────────────────────────────────────────
const created = parseTaskCreate({ title: "  Read   chapter 3  " });
eq(created.ok && created.value.title, "Read chapter 3", "the title is trimmed and the gaps collapsed");
eq(created.ok && created.value, created.ok && {
  title: "Read chapter 3", description: null, dueDate: null, dueTime: null,
  priority: "MEDIUM", status: "NOT_STARTED", tags: [], subtasks: [], subject: null, category: null,
}, "a title is enough, and the rest has a default");
eq(parseTaskCreate({ title: "   " }).ok, false, "a blank title is refused");
eq(parseTaskCreate({}).error, "A task needs a title", "no title is refused");
eq(parseTaskCreate({ title: "x", dueDate: "2026-02-30" }).error, "That date isn't valid", "30 February is not a day");
eq(parseTaskCreate({ title: "x", dueTime: "09:00" }).error, "A time needs a date", "a time with no date is refused");
eq(parseTaskCreate({ title: "x", dueDate: TODAY, dueTime: "09:00:30" }).value.dueTime, "09:00", "seconds are dropped");
eq(parseTaskCreate({ title: "x", dueTime: "9:00" }).error, "Time must be HH:MM", "an unpadded time is refused");
eq(parseTaskCreate({ title: "x", priority: "high" }).error, "Priority isn't one of the choices", "priority is the four names");
eq(parseTaskCreate({ title: "x".repeat(201) }).error, "A title can be at most 200 characters", "title length");
const tagged = parseTaskCreate({ title: "x", tags: [" Exam ", "exam", "", "Quiz"] });
eq(tagged.value.tags, ["Exam", "Quiz"], "tags trim, drop blanks, and ignore case duplicates");
eq(parseTaskCreate({ title: "x", tags: Array.from({ length: 13 }, (_, i) => `t${i}`) }).error, "At most 12 tags", "tag count");
const steps = parseTaskCreate({
  title: "x",
  subtasks: [{ title: "  ", done: false }, { title: "One", done: true }, { id: "s1", title: "Two", done: false }],
});
eq(steps.value.subtasks, [{ title: "One", done: true }, { id: "s1", title: "Two", done: false }], "a blank step is dropped");
eq(parseTaskCreate({ title: "x", subjectName: "  Physics ", subjectColor: "teal" }).value.subject,
  { id: null, name: "Physics", color: "teal" }, "a new subject is trimmed");
eq(parseTaskCreate({ title: "x", subjectColor: "lime" }).error, "Pick a color from the list", "colors are the palette");
eq(parseTaskCreate({ title: "x", subtasks: [{ title: "A", done: "yes" }] }).error,
  "A step needs to say whether it is done", "a step's done flag is a boolean");

eq(parseTaskPatch({}).error, "Nothing to change", "an empty edit is refused");
eq(parseTaskPatch({ status: "COMPLETED" }).value, { status: "COMPLETED" }, "ticking a task sends only the status");
eq(parseTaskPatch({ dueDate: null, dueTime: "10:00" }).value, { dueDate: null, dueTime: null },
  "clearing the date in the same save clears the time");
eq(parseTaskPatch({ dueTime: "10:00" }).value, { dueTime: "10:00" },
  "a time on its own is kept for the service to check against the task's date");
eq(parseTaskPatch({ subtasks: [], subtask: { id: "s", done: true } }).error, "Update the steps one way at a time",
  "the two step edits are not combined");
eq(parseTaskPatch({ subjectId: null, subjectName: null }).value.subject, { id: null, name: null, color: null },
  "sending the subject keys empty clears it");
eq(parseTaskPatch({ description: "   " }).value.description, null, "a cleared description is stored as none");

eq(nextCompletedAt({ status: "NOT_STARTED", completedAt: null }, "COMPLETED", "2026-10-25T12:00:00.000Z"),
  "2026-10-25T12:00:00.000Z", "finishing stamps now");
eq(nextCompletedAt({ status: "COMPLETED", completedAt: "2026-10-20T08:00:00.000Z" }, "COMPLETED", "2026-10-25T12:00:00.000Z"),
  "2026-10-20T08:00:00.000Z", "saving an already finished task keeps the original time");
eq(nextCompletedAt({ status: "COMPLETED", completedAt: "2026-10-20T08:00:00.000Z" }, "IN_PROGRESS", "2026-10-25T12:00:00.000Z"),
  null, "leaving finished clears the time");
eq(nextDeadline({ dueDate: TODAY, dueTime: "09:00" }, { dueDate: null }),
  { dueDate: null, dueTime: null }, "clearing the date drops the time it had");
eq(nextDeadline({ dueDate: null, dueTime: null }, { dueTime: "09:00" }).error, "A time needs a date",
  "a time on a dateless task is refused");
eq(nextDeadline({ dueDate: TODAY, dueTime: null }, { dueTime: "18:30" }),
  { dueDate: TODAY, dueTime: "18:30" }, "a time lands on the date the task already has");

eq(parseLabelCreate({ name: "  Biology " }).value, { name: "Biology", color: null }, "a subject needs a name");
eq(parseLabelCreate({ name: "" }).ok, false, "a blank name is refused");
eq(parseLabelPatch({ color: "rose" }).value, { color: "rose" }, "a color can change on its own");
eq(parseLabelPatch({}).error, "Nothing to change", "an empty label edit is refused");
eq(normalizeTags(["  "]), [], "a blank tag is nothing");
eq(nextColor(["sky", "sky", "cyan"]), "teal", "a new color skips the ones already used twice");
ok(TASK_COLORS.includes(nextColor([])), "with nothing used, the first palette color is a real one");

// ── the migration agrees with the defaults ───────────────────────────────────
const sql = readFileSync(new URL("../prisma/manual-migrations/039-study-tasks.sql", import.meta.url), "utf8");
for (const category of DEFAULT_CATEGORIES) {
  ok(sql.includes(`'${category.name}'`), `migration seeds ${category.name}`);
  ok(sql.includes(`'${category.id}'`), `migration seeds ${category.id}`);
  ok(TASK_COLORS.includes(category.color), `${category.name} uses a palette color`);
}
eq(new Set(DEFAULT_CATEGORIES.map((c) => c.id)).size, DEFAULT_CATEGORIES.length, "category ids are unique");
eq(sql.split("ENABLE ROW LEVEL SECURITY").length - 1, 4, "all four tables enable row level security");
ok(sql.includes("ON DELETE SET NULL"), "removing a subject or category keeps the task");
ok(sql.includes("ON DELETE CASCADE"), "removing a task removes its steps");
ok(sql.includes("WHERE NOT EXISTS"), "a re-run does not put the defaults back over a rename");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
