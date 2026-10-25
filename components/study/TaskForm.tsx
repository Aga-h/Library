"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Field, inputCls } from "@/components/ui/form";
import ColorSwatches from "@/components/study/ColorSwatches";
import {
  PRIORITY_LABEL, STATUS_LABEL, TASK_PRIORITIES, TASK_STATUSES,
  nextColor, type StudyLabel, type StudyTask, type TaskColor, type TaskPriority, type TaskStatus,
} from "@/lib/study-tasks";

export interface TaskFormValues {
  title: string;
  description: string;
  subjectId: string;
  addingSubject: boolean;
  newSubject: string;
  subjectColor: TaskColor;
  categoryId: string;
  addingCategory: boolean;
  newCategory: string;
  categoryColor: TaskColor;
  dueDate: string;
  dueTime: string;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  tagDraft: string;
  subtasks: { key: string; id?: string; title: string; done: boolean }[];
}

export function emptyTaskForm(dueDate: string, subjectColor: TaskColor, categoryColor: TaskColor): TaskFormValues {
  return {
    title: "",
    description: "",
    subjectId: "",
    addingSubject: false,
    newSubject: "",
    subjectColor,
    categoryId: "",
    addingCategory: false,
    newCategory: "",
    categoryColor,
    dueDate,
    dueTime: "",
    priority: "MEDIUM",
    status: "NOT_STARTED",
    tags: [],
    tagDraft: "",
    subtasks: [],
  };
}

export function taskToForm(task: StudyTask, subjectColor: TaskColor, categoryColor: TaskColor): TaskFormValues {
  return {
    ...emptyTaskForm(task.dueDate ?? "", subjectColor, categoryColor),
    title: task.title,
    description: task.description ?? "",
    subjectId: task.subjectId ?? "",
    categoryId: task.categoryId ?? "",
    dueTime: task.dueTime ?? "",
    priority: task.priority,
    status: task.status,
    tags: [...task.tags],
    subtasks: task.subtasks.map((step) => ({ key: step.id, id: step.id, title: step.title, done: step.done })),
  };
}

export function validateTaskForm(values: TaskFormValues): string | null {
  if (!values.title.trim()) return "A task needs a title";
  if (values.addingSubject && !values.newSubject.trim()) return "Name the new subject, or choose one.";
  if (values.addingCategory && !values.newCategory.trim()) return "Name the new category, or choose one.";
  return null;
}

/** The JSON the task routes accept. A half-typed tag is included so it is not lost on save. */
export function taskPayload(values: TaskFormValues): Record<string, unknown> {
  const tags = values.tagDraft.trim() ? [...values.tags, values.tagDraft] : values.tags;
  return {
    title: values.title,
    description: values.description,
    dueDate: values.dueDate || null,
    dueTime: values.dueTime || null,
    priority: values.priority,
    status: values.status,
    tags,
    subtasks: values.subtasks
      .filter((step) => step.title.trim() !== "")
      .map((step) => ({
        ...(step.id ? { id: step.id } : {}),
        title: step.title,
        done: step.done,
      })),
    subjectId: values.addingSubject ? null : (values.subjectId || null),
    subjectName: values.addingSubject ? values.newSubject : null,
    subjectColor: values.subjectColor,
    categoryId: values.addingCategory ? null : (values.categoryId || null),
    categoryName: values.addingCategory ? values.newCategory : null,
    categoryColor: values.categoryColor,
  };
}

export default function TaskForm({
  mode, subjects, categories, initial, suggestedDate, busy, submitLabel, onSubmit, onCancel,
}: {
  mode: "create" | "edit";
  subjects: StudyLabel[];
  categories: StudyLabel[];
  initial: TaskFormValues;
  /** Create only: the date the current view is about. Fills an empty form when the view changes. */
  suggestedDate?: string;
  busy: boolean;
  submitLabel: string;
  onSubmit: (values: TaskFormValues) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [details, setDetails] = useState(mode === "edit");
  const seenDate = useRef(suggestedDate);

  useEffect(() => {
    if (suggestedDate === undefined || suggestedDate === seenDate.current) return;
    seenDate.current = suggestedDate;
    setValues((current) => current.title.trim() === "" ? { ...current, dueDate: suggestedDate } : current);
  }, [suggestedDate]);

  function patch(partial: Partial<TaskFormValues>) {
    setValues((current) => ({ ...current, ...partial }));
  }

  function commitTag() {
    const draft = values.tagDraft.trim();
    if (!draft) return;
    const exists = values.tags.some((tag) => tag.toLowerCase() === draft.toLowerCase());
    patch({ tags: exists ? values.tags : [...values.tags, draft], tagDraft: "" });
  }

  const showDetails = mode === "edit" || details;
  const subjectChoice = values.addingSubject ? "__new__" : values.subjectId;
  const categoryChoice = values.addingCategory ? "__new__" : values.categoryId;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values.tagDraft.trim() ? { ...values, tags: commitTags(values), tagDraft: "" } : values);
      }}
      className={mode === "create" ? "bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3" : "space-y-3"}
    >
      {mode === "create" && (
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">New task</h3>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          required
          value={values.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder={mode === "create" ? "What you need to do" : undefined}
          aria-label="Task title"
          maxLength={200}
          className={`${inputCls} flex-1 min-w-0`}
        />
        {mode === "create" && (
          <input
            type="date"
            value={values.dueDate}
            onChange={(e) => patch({ dueDate: e.target.value })}
            aria-label="Due date"
            className={`${inputCls} sm:w-40`}
          />
        )}
        <button
          type="submit"
          disabled={busy}
          className="bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors max-sm:w-full"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="p-2.5 text-gray-400 hover:text-gray-900 transition-colors self-center"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {mode === "create" && (
        <button
          type="button"
          onClick={() => setDetails((open) => !open)}
          aria-expanded={details}
          className="text-xs font-semibold text-sky-700 hover:text-sky-900"
        >
          {details ? "Fewer details" : "Details"}
        </button>
      )}

      {showDetails && (
        <div className="space-y-3">
          <Field label="Description">
            <textarea
              value={values.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={3}
              maxLength={4000}
              placeholder="Notes, pages, what done looks like"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Field label="Subject">
                <select
                  value={subjectChoice}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      patch({
                        addingSubject: true,
                        newSubject: "",
                        subjectColor: nextColor(subjects.map((subject) => subject.color)),
                      });
                    } else {
                      patch({ addingSubject: false, subjectId: e.target.value });
                    }
                  }}
                  className={inputCls}
                >
                  <option value="">No subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                  <option value="__new__">New subject…</option>
                </select>
              </Field>
              {values.addingSubject && (
                <>
                  <input
                    type="text"
                    value={values.newSubject}
                    onChange={(e) => patch({ newSubject: e.target.value })}
                    placeholder="Mathematics, Physics…"
                    aria-label="New subject"
                    maxLength={60}
                    className={inputCls}
                  />
                  <ColorSwatches
                    value={values.subjectColor}
                    onChange={(subjectColor) => patch({ subjectColor })}
                    label="Subject color"
                  />
                </>
              )}
            </div>

            <div className="space-y-2">
              <Field label="Category">
                <select
                  value={categoryChoice}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      patch({
                        addingCategory: true,
                        newCategory: "",
                        categoryColor: nextColor(categories.map((category) => category.color)),
                      });
                    } else {
                      patch({ addingCategory: false, categoryId: e.target.value });
                    }
                  }}
                  className={inputCls}
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                  <option value="__new__">New category…</option>
                </select>
              </Field>
              {values.addingCategory && (
                <>
                  <input
                    type="text"
                    value={values.newCategory}
                    onChange={(e) => patch({ newCategory: e.target.value })}
                    placeholder="Homework, revision…"
                    aria-label="New category"
                    maxLength={60}
                    className={inputCls}
                  />
                  <ColorSwatches
                    value={values.categoryColor}
                    onChange={(categoryColor) => patch({ categoryColor })}
                    label="Category color"
                  />
                </>
              )}
            </div>

            {mode === "edit" && (
              <Field label="Due date">
                <input
                  type="date"
                  value={values.dueDate}
                  onChange={(e) => patch({ dueDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
            )}
            <Field label="Due time">
              <input
                type="time"
                value={values.dueTime}
                onChange={(e) => patch({ dueTime: e.target.value })}
                step={60}
                className={inputCls}
              />
            </Field>
            <Field label="Priority">
              <select
                value={values.priority}
                onChange={(e) => patch({ priority: e.target.value as TaskPriority })}
                className={inputCls}
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{PRIORITY_LABEL[priority]}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={values.status}
                onChange={(e) => patch({ status: e.target.value as TaskStatus })}
                className={inputCls}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Tags</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {values.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => patch({ tags: values.tags.filter((item) => item !== tag) })}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-700 hover:bg-gray-200"
                >
                  {tag}
                  <X className="w-3 h-3" aria-hidden />
                  <span className="sr-only">Remove {tag}</span>
                </button>
              ))}
              <input
                type="text"
                value={values.tagDraft}
                onChange={(e) => patch({ tagDraft: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    commitTag();
                  } else if (e.key === "Backspace" && values.tagDraft === "" && values.tags.length > 0) {
                    e.preventDefault();
                    patch({ tags: values.tags.slice(0, -1) });
                  }
                }}
                onBlur={commitTag}
                placeholder="Add a tag"
                aria-label="Add a tag"
                maxLength={32}
                className={`${inputCls} w-36`}
              />
            </div>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-3">
            <span className="text-sm font-medium text-gray-700">Steps</span>
            {values.subtasks.map((step, index) => (
              <div key={step.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={step.done}
                  onChange={(e) => {
                    const subtasks = values.subtasks.slice();
                    subtasks[index] = { ...step, done: e.target.checked };
                    patch({ subtasks });
                  }}
                  aria-label={`Step done: ${step.title || "untitled"}`}
                  className="w-5 h-5 flex-shrink-0"
                />
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) => {
                    const subtasks = values.subtasks.slice();
                    subtasks[index] = { ...step, title: e.target.value };
                    patch({ subtasks });
                  }}
                  placeholder="A smaller step"
                  aria-label={`Step ${index + 1}`}
                  maxLength={200}
                  className={`${inputCls} flex-1 min-w-0`}
                />
                <button
                  type="button"
                  onClick={() => patch({ subtasks: values.subtasks.filter((item) => item.key !== step.key) })}
                  aria-label={`Remove step ${index + 1}`}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => patch({
                subtasks: [...values.subtasks, { key: newStepKey(), title: "", done: false }],
              })}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
            >
              <Plus className="w-3.5 h-3.5" /> Add a step
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function commitTags(values: TaskFormValues): string[] {
  const draft = values.tagDraft.trim();
  if (!draft) return values.tags;
  if (values.tags.some((tag) => tag.toLowerCase() === draft.toLowerCase())) return values.tags;
  return [...values.tags, draft];
}

function newStepKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `step-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
