"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { inputCls } from "@/components/ui/form";
import ColorSwatches from "@/components/study/ColorSwatches";
import {
  colorClass, isTaskColor, nextColor, type StudyLabel, type StudyTask, type TaskColor,
} from "@/lib/study-tasks";

type Kind = "subject" | "category";

export default function StudyLabels({
  subjects, categories, tasks, busy, onCreate, onUpdate, onDelete,
}: {
  subjects: StudyLabel[];
  categories: StudyLabel[];
  tasks: StudyTask[];
  busy: boolean;
  onCreate: (kind: Kind, name: string, color: TaskColor) => Promise<boolean>;
  onUpdate: (kind: Kind, id: string, patch: { name: string; color: TaskColor | null }) => Promise<boolean>;
  onDelete: (kind: Kind, id: string) => Promise<boolean>;
}) {
  return (
    <details className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <summary className="text-sm font-semibold text-gray-800 cursor-pointer">
        Subjects and categories
      </summary>
      <p className="text-xs text-gray-500 mt-2 mb-4">
        A subject is the course. A category is the kind of work — homework, revision, an exam.
        Renaming either keeps the tasks filed under it.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <LabelColumn
          kind="subject"
          title="Subjects"
          labels={subjects}
          tasks={tasks}
          busy={busy}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
        <LabelColumn
          kind="category"
          title="Categories"
          labels={categories}
          tasks={tasks}
          busy={busy}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </div>
    </details>
  );
}

function LabelColumn({
  kind, title, labels, tasks, busy, onCreate, onUpdate, onDelete,
}: {
  kind: Kind;
  title: string;
  labels: StudyLabel[];
  tasks: StudyTask[];
  busy: boolean;
  onCreate: (kind: Kind, name: string, color: TaskColor) => Promise<boolean>;
  onUpdate: (kind: Kind, id: string, patch: { name: string; color: TaskColor | null }) => Promise<boolean>;
  onDelete: (kind: Kind, id: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TaskColor>("sky");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftColor, setDraftColor] = useState<TaskColor>(nextColor(labels.map((label) => label.color)));

  const filed = (id: string) => tasks.filter((task) => (kind === "subject" ? task.subjectId : task.categoryId) === id);
  const noun = kind === "subject" ? "subject" : "category";

  return (
    <div>
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{title}</h3>
      <ul className="space-y-2">
        {labels.map((label) => {
          const all = filed(label.id);
          const open = all.filter((task) => task.status !== "COMPLETED").length;
          const swatch = colorClass(label.color);
          if (editing === label.id) {
            return (
              <li key={label.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-label={`${noun} name`}
                    maxLength={60}
                    className={`${inputCls} flex-1 min-w-0`}
                  />
                  <button
                    type="button"
                    disabled={busy || name.trim() === ""}
                    onClick={async () => {
                      if (await onUpdate(kind, label.id, { name: name.trim(), color })) setEditing(null);
                    }}
                    className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)} aria-label="Cancel" className="p-2 text-gray-400 hover:text-gray-900">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <ColorSwatches value={color} onChange={setColor} label={`${noun} color`} />
              </li>
            );
          }
          return (
            <li key={label.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${swatch.dot}`} aria-hidden />
                <span className="text-sm text-gray-900 break-words">{label.name}</span>
                <span className="text-[11px] text-gray-400 tabular-nums">{open}</span>
              </span>
              {confirming === label.id ? (
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (await onDelete(kind, label.id)) setConfirming(null);
                    }}
                    className="bg-red-600 text-white px-2.5 py-1.5 max-sm:py-2.5 rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} aria-label="Keep it" className="p-1.5 text-gray-400 hover:text-gray-900">
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ) : (
                <span className="flex items-center flex-shrink-0">
                  <button
                    type="button"
                    aria-label={`Rename ${label.name}`}
                    onClick={() => {
                      setEditing(label.id);
                      setName(label.name);
                      setColor(isTaskColor(label.color) ? label.color : "slate");
                      setConfirming(null);
                    }}
                    className="p-2 max-sm:p-2.5 text-gray-400 hover:text-gray-900"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${label.name}`}
                    onClick={() => { setConfirming(label.id); setEditing(null); }}
                    className="p-2 max-sm:p-2.5 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {confirming === label.id && all.length > 0 && (
                <span className="sr-only">
                  {all.length} {all.length === 1 ? "task stays" : "tasks stay"}, without this {noun}.
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {confirming && filed(confirming).length > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          {filed(confirming).length === 1 ? "1 task stays" : `${filed(confirming).length} tasks stay`}, without this {noun}.
        </p>
      )}
      {labels.length === 0 && <p className="text-xs text-gray-400">None yet.</p>}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onCreate(kind, draft, draftColor)) {
            setDraft("");
            setDraftColor(nextColor([...labels.map((label) => label.color), draftColor]));
          }
        }}
        className="mt-3 space-y-2"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={kind === "subject" ? "New subject" : "New category"}
            aria-label={kind === "subject" ? "New subject" : "New category"}
            maxLength={60}
            className={`${inputCls} flex-1 min-w-0`}
          />
          <button
            type="submit"
            disabled={busy || draft.trim() === ""}
            aria-label={kind === "subject" ? "Add subject" : "Add category"}
            className="p-2.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <ColorSwatches value={draftColor} onChange={setDraftColor} label={kind === "subject" ? "New subject color" : "New category color"} />
      </form>
    </div>
  );
}
