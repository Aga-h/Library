"use client";

import { Pencil, Trash2, X } from "lucide-react";
import {
  PRIORITY_DOT, PRIORITY_LABEL, STATUS_LABEL, colorClass, deadlineLabel, deadlineTone,
  formatInstantDay, type StudyLabel, type StudyTask,
} from "@/lib/study-tasks";

const TONE = {
  overdue: "text-red-600 font-semibold",
  today: "text-sky-800 font-semibold",
  soon: "text-gray-800",
  later: "text-gray-500",
  none: "text-gray-400",
} as const;

export default function TaskRow({
  task, subject, category, today, clock, open, confirming, busy,
  onToggleOpen, onToggleDone, onToggleSubtask, onEdit, onAskDelete, onCancelDelete, onDelete,
}: {
  task: StudyTask;
  subject: StudyLabel | null;
  category: StudyLabel | null;
  today: string;
  clock: string;
  open: boolean;
  confirming: boolean;
  busy: boolean;
  onToggleOpen: () => void;
  onToggleDone: () => void;
  onToggleSubtask: (id: string, done: boolean) => void;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const done = task.status === "COMPLETED";
  const stepsDone = task.subtasks.filter((step) => step.done).length;
  const allStepsDone = task.subtasks.length > 0 && stepsDone === task.subtasks.length;
  const tone = deadlineTone(task, today, clock);

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={done}
          disabled={busy}
          onChange={onToggleDone}
          aria-label={done ? `Mark “${task.title}” not done` : `Mark “${task.title}” done`}
          className="mt-0.5 w-5 h-5 flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={onToggleOpen}
              aria-expanded={open}
              className={`text-left font-semibold text-sm break-words ${done ? "line-through text-gray-400" : "text-gray-900"}`}
            >
              {task.title}
            </button>
            {confirming ? (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={busy}
                  className="bg-red-600 text-white px-2.5 py-1.5 max-sm:px-3.5 max-sm:py-2.5 rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={onCancelDelete}
                  aria-label="Keep it"
                  className="p-1.5 max-sm:p-2.5 text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center flex-shrink-0">
                <button
                  type="button"
                  onClick={onEdit}
                  aria-label={`Edit ${task.title}`}
                  className="p-2 max-sm:p-2.5 text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onAskDelete}
                  aria-label={`Delete ${task.title}`}
                  className="p-2 max-sm:p-2.5 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} aria-hidden />
              {PRIORITY_LABEL[task.priority]}
            </span>
            {subject && (
              <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${colorClass(subject.color).chip}`}>
                {subject.name}
              </span>
            )}
            {category && <span>{category.name}</span>}
            <span className={TONE[tone]}>{deadlineLabel(task, today, clock)}</span>
            {task.status === "IN_PROGRESS" && <span>{STATUS_LABEL.IN_PROGRESS}</span>}
            {task.subtasks.length > 0 && (
              <span className="tabular-nums">{stepsDone}/{task.subtasks.length}</span>
            )}
            {allStepsDone && !done && <span className="text-sky-800">All steps done</span>}
          </p>

          {!open && task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1 break-words">{task.description}</p>
          )}

          {open && (
            <div className="mt-3 space-y-3">
              {task.description && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{task.description}</p>
              )}
              {task.tags.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {task.tags.map((tag) => (
                    <li key={tag} className="px-1.5 py-0.5 rounded bg-gray-100 text-[11px] text-gray-600">{tag}</li>
                  ))}
                </ul>
              )}
              {task.subtasks.length > 0 && (
                <ul className="space-y-1.5">
                  {task.subtasks.map((step) => (
                    <li key={step.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={step.done}
                        disabled={busy}
                        onChange={() => onToggleSubtask(step.id, !step.done)}
                        aria-label={step.done ? `Mark “${step.title}” not done` : `Mark “${step.title}” done`}
                        className="mt-0.5 w-5 h-5 flex-shrink-0"
                      />
                      <span className={`text-sm break-words ${step.done ? "line-through text-gray-400" : "text-gray-800"}`}>
                        {step.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-gray-400">
                Added {formatInstantDay(task.createdAt)}
                {task.completedAt ? ` · Finished ${formatInstantDay(task.completedAt)}` : ""}
              </p>
            </div>
          )}
        </div>
      </div>
      {confirming && (
        <p className="text-xs text-red-600 mt-2 pl-8">Delete this task? This can’t be undone.</p>
      )}
    </li>
  );
}
