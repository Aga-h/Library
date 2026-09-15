"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Plus, XCircle } from "lucide-react";
import { MODULE_COLOR_META } from "@/lib/stats";
import { dayVerdict, type ModuleView, type TaskView } from "@/lib/tasks";
import { clockFromMinutes, dayName, dayNumber, monthName } from "@/lib/time";
import DayVerdictBadge from "@/components/tasks/DayVerdictBadge";
import TaskDialog, { type DialogTarget } from "@/components/tasks/TaskDialog";

const PX_PER_MIN = 0.8;      // 48px an hour
const SNAP_MINUTES = 30;
const DEFAULT_SPAN = 60;
const DAY_HEIGHT = 24 * 60 * PX_PER_MIN;

export default function WeekCalendar({
  days,
  today,
  tasks,
  modules,
}: {
  days: string[];
  today: string;
  tasks: TaskView[];
  modules: ModuleView[];
}) {
  const [target, setTarget] = useState<DialogTarget | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Open on the working day rather than at midnight.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7 * 60 * PX_PER_MIN;
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, TaskView[]>();
    for (const day of days) map.set(day, []);
    for (const task of tasks) map.get(task.day)?.push(task);
    return map;
  }, [days, tasks]);

  function openSlot(day: string, minutes: number) {
    const start = Math.max(0, Math.min(1440 - SNAP_MINUTES, Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES));
    setTarget({
      mode: "create",
      day,
      startMinutes: start,
      endMinutes: Math.min(1440, start + DEFAULT_SPAN),
    });
  }

  function bookNow() {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const day = days.includes(today) ? today : days[0];
    openSlot(day, minutes + SNAP_MINUTES);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-100 flex-wrap">
        <p className="text-xs text-gray-400">
          Click any slot to book a module. Click a block to edit it.
        </p>
        <button
          onClick={bookNow}
          className="flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Book a task
        </button>
      </div>

      {/* Day headers */}
      <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: "3.5rem repeat(7, minmax(0, 1fr))" }}>
        <div className="border-r border-gray-100" />
        {days.map((day) => {
          const dayTasks = byDay.get(day) ?? [];
          const verdict = dayVerdict(dayTasks);
          const isToday = day === today;
          return (
            <div key={day} className={`px-2 py-2.5 border-r border-gray-100 last:border-r-0 ${isToday ? "bg-gray-50" : ""}`}>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-gray-900" : "text-gray-400"}`}>
                  {dayName(day, true)}
                </span>
                <span className={`text-sm font-semibold ${isToday ? "text-gray-900" : "text-gray-500"}`}>
                  {dayNumber(day)}
                </span>
                <span className="text-[10px] text-gray-400">{monthName(day, true)}</span>
              </div>
              <div className="mt-1.5">
                {verdict.outcome === "EMPTY" ? (
                  <span className="text-[10px] text-gray-300">—</span>
                ) : (
                  <DayVerdictBadge verdict={verdict} showCounts={false} future={day > today} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hour grid */}
      <div ref={scroller} className="overflow-y-auto" style={{ maxHeight: "62vh" }}>
        <div className="grid" style={{ gridTemplateColumns: "3.5rem repeat(7, minmax(0, 1fr))" }}>
          {/* Hour gutter */}
          <div className="border-r border-gray-100 relative" style={{ height: DAY_HEIGHT }}>
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] text-gray-400 tabular-nums"
                style={{ top: hour * 60 * PX_PER_MIN }}
              >
                {hour > 0 ? `${String(hour).padStart(2, "0")}:00` : ""}
              </div>
            ))}
          </div>

          {days.map((day) => (
            <DayColumn
              key={day}
              isToday={day === today}
              tasks={byDay.get(day) ?? []}
              onSlot={(minutes) => openSlot(day, minutes)}
              onTask={(task) =>
                setTarget({
                  mode: "edit",
                  task,
                  day: task.day,
                  startMinutes: task.startMinutes,
                  endMinutes: task.endMinutes,
                })
              }
            />
          ))}
        </div>
      </div>

      {target && <TaskDialog target={target} modules={modules} onClose={() => setTarget(null)} />}
    </div>
  );
}

function DayColumn({
  isToday,
  tasks,
  onSlot,
  onTask,
}: {
  isToday: boolean;
  tasks: TaskView[];
  onSlot: (minutes: number) => void;
  onTask: (task: TaskView) => void;
}) {
  const lanes = useMemo(() => assignLanes(tasks), [tasks]);

  return (
    <div
      className={`relative border-r border-gray-100 last:border-r-0 ${isToday ? "bg-gray-50/60" : ""}`}
      style={{ height: DAY_HEIGHT }}
      onClick={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        onSlot((e.clientY - box.top) / PX_PER_MIN);
      }}
    >
      {/* Hour lines */}
      {Array.from({ length: 24 }, (_, hour) => (
        <div
          key={hour}
          className="absolute left-0 right-0 border-t border-gray-100"
          style={{ top: hour * 60 * PX_PER_MIN }}
        />
      ))}

      {tasks.map((task) => {
        const lane = lanes.get(task.id) ?? { index: 0, count: 1 };
        const color = MODULE_COLOR_META[task.color];
        const top = task.startMinutes * PX_PER_MIN;
        const height = Math.max(20, (task.endMinutes - task.startMinutes) * PX_PER_MIN);
        const width = 100 / lane.count;
        const failed = task.status === "FAILED";
        const done = task.status === "COMPLETED";

        return (
          <button
            key={task.id}
            onClick={(e) => { e.stopPropagation(); onTask(task); }}
            className={`absolute rounded-md border px-1.5 py-1 text-left overflow-hidden transition-shadow hover:shadow-md ${color.block} ${
              failed ? "opacity-50 border-dashed" : ""
            } ${done ? "ring-1 ring-emerald-400" : ""} ${task.runningSince ? "ring-2 ring-gray-900" : ""}`}
            style={{
              top,
              height,
              left: `calc(${lane.index * width}% + 2px)`,
              width: `calc(${width}% - 4px)`,
            }}
          >
            <span className="flex items-center gap-1 text-[11px] font-semibold leading-tight">
              {done && <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-emerald-600" />}
              {failed && <XCircle className="w-3 h-3 flex-shrink-0 text-red-500" />}
              <span className="truncate">{task.title}</span>
            </span>
            {height > 32 && (
              <span className="block text-[10px] opacity-70 leading-tight">
                {clockFromMinutes(task.startMinutes)}–{clockFromMinutes(task.endMinutes)}
              </span>
            )}
          </button>
        );
      })}

      {tasks.length === 0 && (
        <div className="absolute inset-0 flex items-start justify-center pt-24 pointer-events-none">
          <Plus className="w-4 h-4 text-gray-200" />
        </div>
      )}
    </div>
  );
}

/** Side-by-side placement for tasks whose windows overlap. */
function assignLanes(tasks: TaskView[]): Map<string, { index: number; count: number }> {
  const result = new Map<string, { index: number; count: number }>();
  const sorted = [...tasks].sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  let cluster: TaskView[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes: TaskView[][] = [];
    for (const task of cluster) {
      let lane = lanes.find((l) => l[l.length - 1].endMinutes <= task.startMinutes);
      if (!lane) { lane = []; lanes.push(lane); }
      lane.push(task);
    }
    lanes.forEach((lane, index) => {
      for (const task of lane) result.set(task.id, { index, count: lanes.length });
    });
    cluster = [];
    clusterEnd = -1;
  };

  for (const task of sorted) {
    if (cluster.length > 0 && task.startMinutes >= clusterEnd) flush();
    cluster.push(task);
    clusterEnd = Math.max(clusterEnd, task.endMinutes);
  }
  if (cluster.length > 0) flush();

  return result;
}
