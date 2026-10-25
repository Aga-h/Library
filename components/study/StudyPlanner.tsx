"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SearchInput from "@/components/ui/SearchInput";
import { inputCls } from "@/components/ui/form";
import { useBringIntoReach } from "@/components/study/useBringIntoReach";
import StudyLabels from "@/components/study/StudyLabels";
import TaskForm, { emptyTaskForm, taskPayload, taskToForm, validateTaskForm, type TaskFormValues } from "@/components/study/TaskForm";
import TaskRow from "@/components/study/TaskRow";
import { addDays, clockKey, todayKey, weekStartOf, type DateKey } from "@/lib/dates";
import {
  PRIORITY_LABEL, STATUS_LABEL, TASK_PRIORITIES, TASK_VIEWS,
  applyTaskQuery, countOpenBy, dayOfMonth, defaultDueDate, emptyCopy,
  formatDay, formatWeek, listProgress, nextColor, plannerOverview,
  taskMatches, weekDays, weekdayShort,
  type StudyLabel, type StudyTask, type TaskListQuery, type TaskPriority, type TaskSort, type TaskStatus, type TaskView,
} from "@/lib/study-tasks";

const VIEW_LABEL: Record<(typeof TASK_VIEWS)[number], string> = {
  today: "Today",
  upcoming: "Upcoming",
  overdue: "Overdue",
  all: "All",
  none: "No date",
  completed: "Done",
};

type StatusFilter = "open" | TaskStatus | "any";

export default function StudyPlanner({
  tasks: initialTasks, subjects, categories, today: serverToday, clock: serverClock,
}: {
  tasks: StudyTask[];
  subjects: StudyLabel[];
  categories: StudyLabel[];
  today: string;
  clock: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState(initialTasks);
  const [taskSource, setTaskSource] = useState(initialTasks);
  // A refresh hands over a new list. Take it during render — an effect would be a second pass,
  // and would wipe a tick that landed in the same moment.
  if (taskSource !== initialTasks) {
    setTaskSource(initialTasks);
    setTasks(initialTasks);
  }
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ticked, setTicked] = useState<number | null>(null);

  const [view, setView] = useState<TaskView>("today");
  const [day, setDay] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority | "any">("any");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [tag, setTag] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchKey, setSearchKey] = useState(0);
  const [sort, setSort] = useState<TaskSort>("deadline");
  const [weekOf, setWeekOf] = useState(serverToday);
  const [addKey, setAddKey] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const editRef = useBringIntoReach<HTMLLIElement>(editing);

  const busy = saving || isPending;
  const today: DateKey = ticked == null ? (serverToday as DateKey) : todayKey(new Date(ticked));
  const clock = ticked == null ? serverClock : clockKey(new Date(ticked));

  useEffect(() => {
    const id = setInterval(() => setTicked(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(id);
  }, [notice]);

  const query: TaskListQuery = {
    view,
    day,
    subjectId,
    categoryId,
    priority: priority === "any" ? null : priority,
    status: status === "any" ? null : status,
    tag,
    search,
    sort,
  };
  const shown = applyTaskQuery(tasks, query, today, clock);
  const rated = applyTaskQuery(tasks, { ...query, status: null }, today, clock);
  const progress = listProgress(view === "completed" ? shown : rated);
  const overview = plannerOverview(tasks, today, clock);
  const subjectCounts = countOpenBy(tasks, "subjectId");
  const categoryCounts = countOpenBy(tasks, "categoryId");
  const tags = [...new Set(tasks.flatMap((task) => task.tags))].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  const narrowed = Boolean(subjectId || categoryId || priority !== "any" || status !== "open" || tag || search.trim());
  const week = weekDays(weekStartOf(weekOf as DateKey));
  const selectedDay = view === "today" ? today : view === "day" ? day : null;
  const subjectColor = nextColor(subjects.map((subject) => subject.color));
  const categoryColor = nextColor(categories.map((category) => category.color));

  async function send(url: string, init: RequestInit, done: string | null): Promise<boolean> {
    if (lock.current) return false;
    lock.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...init.headers },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong");
        return false;
      }
      if (done) setNotice(done);
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError("Couldn't reach the site. Nothing was saved.");
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  async function create(values: TaskFormValues) {
    const problem = validateTaskForm(values);
    if (problem) { setError(problem); setNotice(null); return; }
    if (await send("/api/study/tasks", { method: "POST", body: JSON.stringify(taskPayload(values)) }, "Saved")) {
      setAddKey((key) => key + 1);
    }
  }

  async function save(task: StudyTask, values: TaskFormValues) {
    const problem = validateTaskForm(values);
    if (problem) { setError(problem); setNotice(null); return; }
    if (await send(`/api/study/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify(taskPayload(values)) }, "Saved")) {
      setEditing(null);
    }
  }

  async function markStatus(task: StudyTask, next: TaskStatus) {
    if (lock.current || busy) return;
    const previous = tasks;
    const completedAt = next === "COMPLETED" ? new Date().toISOString() : null;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: next, completedAt } : item));
    if (!await send(`/api/study/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) }, null)) {
      setTasks(previous);
    }
  }

  async function setSubtask(task: StudyTask, id: string, done: boolean) {
    if (lock.current || busy) return;
    const previous = tasks;
    setTasks((current) => current.map((item) => item.id !== task.id ? item : {
      ...item,
      subtasks: item.subtasks.map((step) => step.id === id ? { ...step, done } : step),
    }));
    const ok = await send(`/api/study/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ subtask: { id, done } }),
    }, null);
    if (!ok) setTasks(previous);
  }

  function pickView(next: TaskView) {
    setView(next);
    if (next !== "day") setDay(null);
  }

  function pickDay(key: string) {
    setWeekOf(key);
    if (key === today) pickView("today");
    else { setView("day"); setDay(key); }
  }

  function clearFilters() {
    setSubjectId(null);
    setCategoryId(null);
    setPriority("any");
    setStatus("open");
    setTag(null);
    setSearch("");
    setSearchKey((key) => key + 1);
  }

  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="space-y-2">
        {error && (
          <p className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</p>
        )}
        {notice && <p className="text-sm text-sky-800">{notice}</p>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Tile label="Due today" value={overview.dueToday} />
        <Tile label="Still open" value={overview.remaining} />
        <Tile label="Overdue" value={overview.overdue} warn={overview.overdue > 0} />
        <Tile label="Done this week" value={overview.completedThisWeek} />
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            type="button"
            onClick={() => setWeekOf(addDays(weekStartOf(weekOf as DateKey), -7))}
            aria-label="Previous week"
            className="p-2 max-sm:p-2.5 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-gray-500">{formatWeek(weekStartOf(weekOf as DateKey))}</span>
            {weekStartOf(weekOf as DateKey) !== weekStartOf(today) && (
              <button
                type="button"
                onClick={() => setWeekOf(today)}
                className="text-xs font-semibold text-sky-700 hover:text-sky-900"
              >
                This week
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setWeekOf(addDays(weekStartOf(weekOf as DateKey), 7))}
            aria-label="Next week"
            className="p-2 max-sm:p-2.5 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1">
          {week.map((key) => {
            const count = tasks.filter((task) => taskMatches(task, {
              ...query, view: "day", day: key, status: "open",
            }, today, clock)).length;
            const selected = selectedDay === key;
            const late = key < today && count > 0;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                aria-label={`${formatDay(key)}${count ? `, ${count} open` : ""}`}
                onClick={() => pickDay(key)}
                className={`flex flex-col items-center flex-1 min-w-0 rounded-lg px-0.5 py-1.5 border transition-colors ${
                  selected
                    ? "bg-gray-900 border-gray-900 text-white"
                    : key === today
                      ? "bg-sky-50 border-sky-200 text-gray-900"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className={`text-[10px] font-semibold ${selected ? "text-gray-300" : "text-gray-400"}`}>
                  {weekdayShort(key)}
                </span>
                <span className="text-sm font-bold tabular-nums">{dayOfMonth(key)}</span>
                <span className={`text-[10px] tabular-nums ${count === 0 ? "invisible" : late && !selected ? "text-red-600 font-semibold" : ""}`}>
                  {count || 0}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <TaskForm
        key={`new-${addKey}`}
        mode="create"
        subjects={subjects}
        categories={categories}
        initial={emptyTaskForm(defaultDueDate(view, day, today), subjectColor, categoryColor)}
        suggestedDate={defaultDueDate(view, day, today)}
        busy={busy}
        submitLabel="Add task"
        onSubmit={create}
      />

      <div className="flex flex-wrap gap-1.5">
        {TASK_VIEWS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={view === item}
            onClick={() => pickView(item)}
            className={`px-2.5 py-1.5 max-sm:py-2 rounded-lg text-xs font-semibold border transition-colors ${
              view === item
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {VIEW_LABEL[item]}
            {item === "overdue" && overview.overdue > 0 ? ` ${overview.overdue}` : ""}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <select aria-label="Subject" value={subjectId ?? ""} onChange={(e) => setSubjectId(e.target.value || null)} className={`${inputCls} sm:w-auto`}>
          <option value="">All subjects</option>
          <option value="none">No subject ({subjectCounts.get(null) ?? 0})</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name} ({subjectCounts.get(subject.id) ?? 0})
            </option>
          ))}
        </select>
        <select aria-label="Category" value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value || null)} className={`${inputCls} sm:w-auto`}>
          <option value="">All categories</option>
          <option value="none">No category ({categoryCounts.get(null) ?? 0})</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({categoryCounts.get(category.id) ?? 0})
            </option>
          ))}
        </select>
        <select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority | "any")} className={`${inputCls} sm:w-auto`}>
          <option value="any">Any priority</option>
          {TASK_PRIORITIES.map((item) => (
            <option key={item} value={item}>{PRIORITY_LABEL[item]}</option>
          ))}
        </select>
        {view !== "completed" && (
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={`${inputCls} sm:w-auto`}>
            <option value="open">Open</option>
            <option value="NOT_STARTED">{STATUS_LABEL.NOT_STARTED}</option>
            <option value="IN_PROGRESS">{STATUS_LABEL.IN_PROGRESS}</option>
            <option value="COMPLETED">{STATUS_LABEL.COMPLETED}</option>
            <option value="any">Any status</option>
          </select>
        )}
        {tags.length > 0 && (
          <select aria-label="Tag" value={tag ?? ""} onChange={(e) => setTag(e.target.value || null)} className={`${inputCls} sm:w-auto`}>
            <option value="">Any tag</option>
            {tags.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        )}
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as TaskSort)} className={`${inputCls} sm:w-auto`}>
          <option value="deadline">Deadline</option>
          <option value="priority">Priority</option>
          <option value="created">Newest</option>
          <option value="alpha">A to Z</option>
        </select>
        <SearchInput key={searchKey} defaultValue={search} onSearch={setSearch} placeholder="Search tasks" />
        {narrowed && (
          <button type="button" onClick={clearFilters} className="text-xs font-semibold text-gray-500 hover:text-gray-900 px-1 max-sm:py-2">
            Clear
          </button>
        )}
      </div>

      {progress.total > 0 && view !== "completed" && (
        <div>
          <div className="flex items-baseline justify-between gap-3 text-xs text-gray-500">
            <span>{progress.done} of {progress.total} done</span>
            <span className="tabular-nums">{Math.round(progress.fraction * 100)}%</span>
          </div>
          <div
            className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.fraction * 100)}
            aria-label="Completion of this list"
          >
            <div
              className={`h-full rounded-full ${progress.fraction === 1 ? "bg-emerald-500" : "bg-sky-500"}`}
              style={{ width: `${Math.round(progress.fraction * 100)}%` }}
            />
          </div>
        </div>
      )}
      {view === "completed" && shown.length > 0 && (
        <p className="text-xs text-gray-500">{shown.length} finished</p>
      )}

      {tasks.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <p className="font-semibold text-gray-700">Nothing planned yet</p>
          <p className="text-sm text-gray-500 mt-1">Add a task above. A title is enough — the date can wait.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <p className="font-semibold text-gray-700">{emptyCopy(query)}</p>
          {narrowed ? (
            <button type="button" onClick={clearFilters} className="mt-2 text-sm font-semibold text-sky-700 hover:text-sky-900">
              Clear filters
            </button>
          ) : view !== "all" && (
            <button type="button" onClick={() => pickView("all")} className="mt-2 text-sm font-semibold text-sky-700 hover:text-sky-900">
              Show every task
            </button>
          )}
        </div>
      ) : (
        <ul className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {shown.map((task) => (
            editing === task.id ? (
              <li key={task.id} ref={editRef} className="bg-gray-50 px-4 py-4">
                <TaskForm
                  mode="edit"
                  subjects={subjects}
                  categories={categories}
                  initial={taskToForm(task, subjectColor, categoryColor)}
                  busy={busy}
                  submitLabel="Save"
                  onSubmit={(values) => save(task, values)}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <TaskRow
                key={task.id}
                task={task}
                subject={task.subjectId ? byId.get(task.subjectId) ?? null : null}
                category={task.categoryId ? categoryById.get(task.categoryId) ?? null : null}
                today={today}
                clock={clock}
                open={openId === task.id}
                confirming={confirming === task.id}
                busy={busy}
                onToggleOpen={() => setOpenId((current) => current === task.id ? null : task.id)}
                onToggleDone={() => markStatus(task, task.status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED")}
                onToggleSubtask={(id, done) => setSubtask(task, id, done)}
                onEdit={() => { setEditing(task.id); setOpenId(null); setConfirming(null); }}
                onAskDelete={() => setConfirming(task.id)}
                onCancelDelete={() => setConfirming(null)}
                onDelete={async () => {
                  if (await send(`/api/study/tasks/${task.id}`, { method: "DELETE" }, "Deleted")) {
                    setConfirming(null);
                    setOpenId(null);
                  }
                }}
              />
            )
          ))}
        </ul>
      )}

      <StudyLabels
        subjects={subjects}
        categories={categories}
        tasks={tasks}
        busy={busy}
        onCreate={(kind, name, color) => send(`/api/study/${kind === "subject" ? "subjects" : "categories"}`, {
          method: "POST", body: JSON.stringify({ name, color }),
        }, "Saved")}
        onUpdate={(kind, id, patch) => send(`/api/study/${kind === "subject" ? "subjects" : "categories"}/${id}`, {
          method: "PATCH", body: JSON.stringify(patch),
        }, "Saved")}
        onDelete={(kind, id) => send(`/api/study/${kind === "subject" ? "subjects" : "categories"}/${id}`, {
          method: "DELETE",
        }, "Deleted")}
      />

    </div>
  );
}

function Tile({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 border ${warn ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
      <p className="text-2xl max-sm:text-xl font-bold tabular-nums text-gray-900">{value}</p>
      <p className={`text-xs mt-0.5 ${warn ? "text-amber-700" : "text-gray-500"}`}>{label}</p>
    </div>
  );
}
