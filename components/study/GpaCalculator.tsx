"use client";

import { useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { inputCls } from "@/components/ui/form";
import {
  GPA_NOT_READY,
  HOURS_ERROR,
  MARK_ERROR,
  MARK_FIELDS,
  MAX_HOURS,
  NAME_ERROR,
  NAME_MAX,
  blankMarkText,
  formatMark,
  halfScore,
  lessonBodyFromTexts,
  lessonScore,
  marksToText,
  numberSoFar,
  parseHoursText,
  parseMarkText,
  scoreInput,
  yearScore,
  type GpaLesson,
  type HalfScore,
  type LessonBody,
  type MarkKey,
} from "@/lib/gpa";

type Draft = {
  id: string;
  name: string;
  hours: string;
  marks: Record<MarkKey, string>;
  error: string | null;
};

function draftFrom(lesson: GpaLesson): Draft {
  return {
    id: lesson.id,
    name: lesson.name,
    hours: formatMark(lesson.hours),
    marks: marksToText(lesson),
    error: null,
  };
}

function snapshot(lesson: GpaLesson): string | null {
  const body = lessonBodyFromTexts(lesson.name, formatMark(lesson.hours), marksToText(lesson), null);
  return body ? JSON.stringify(body) : null;
}

function normalizeMark(text: string): string {
  const parsed = parseMarkText(text);
  if (parsed.state === "ok") return formatMark(parsed.value);
  if (parsed.state === "empty") return "";
  if (parsed.state === "partial") {
    const n = numberSoFar(text);
    if (n !== null && n >= 0 && n <= 100) return formatMark(n);
    return "";
  }
  return text;
}

function normalizeHours(text: string): string {
  const parsed = parseHoursText(text);
  if (parsed.state === "ok") return formatMark(parsed.value);
  if (parsed.state === "partial") {
    const n = numberSoFar(text);
    if (n !== null && n > 0 && n <= MAX_HOURS) return formatMark(n);
  }
  return text;
}

function nameError(text: string, touched: boolean): string | null {
  if (!touched) return null;
  const name = text.trim();
  if (!name) return NAME_ERROR;
  if (name.length > NAME_MAX) return "Keep the name under 80 characters.";
  return null;
}

function hoursError(text: string, touched: boolean): string | null {
  const parsed = parseHoursText(text);
  if (parsed.state === "ok") return null;
  if (!touched && (parsed.state === "partial" || parsed.state === "empty")) return null;
  if (parsed.state === "partial") {
    const n = numberSoFar(text);
    if (n !== null && n > 0 && n <= MAX_HOURS) return null;
  }
  return HOURS_ERROR;
}

function figure(n: number | null): string {
  return n === null ? "—" : formatMark(n);
}

function hoursLine(score: HalfScore, entered: number): string {
  if (score.average === null) return "no marks yet";
  const counted = formatMark(score.hours);
  if (entered > score.hours + 1e-9) {
    const total = formatMark(entered);
    return `${counted} of ${total} ${entered === 1 ? "hour" : "hours"}`;
  }
  return `${counted} ${score.hours === 1 ? "hour" : "hours"}`;
}

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return data.error ?? "Couldn't save";
}

export default function GpaCalculator({ lessons: initial }: { lessons: GpaLesson[] }) {
  const [lessons, setLessons] = useState(() => initial.map(draftFrom));
  const lessonsRef = useRef(lessons);
  const saved = useRef(new Map(initial.flatMap((lesson) => {
    const json = snapshot(lesson);
    return json ? [[lesson.id, json] as const] : [];
  })));
  const tails = useRef(new Map<string, Promise<void>>());
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [hours, setHours] = useState("");
  const [addTried, setAddTried] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function replaceLesson(id: string, recipe: (draft: Draft) => Draft) {
    const next = lessonsRef.current.map((lesson) => (lesson.id === id ? recipe(lesson) : lesson));
    lessonsRef.current = next;
    setLessons(next);
  }

  function touch(id: string, field: string) {
    setTouched((prev) => {
      const key = `${id}:${field}`;
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }

  function edit(id: string, field: "name" | "hours" | MarkKey, value: string) {
    replaceLesson(id, (lesson) => {
      if (field === "name") return { ...lesson, name: value, error: null };
      if (field === "hours") return { ...lesson, hours: value, error: null };
      return { ...lesson, marks: { ...lesson.marks, [field]: value }, error: null };
    });
  }

  function commit(id: string, field: "name" | "hours" | MarkKey) {
    touch(id, field);
    replaceLesson(id, (lesson) => {
      if (field === "name") return { ...lesson, name: lesson.name.trim() };
      if (field === "hours") return { ...lesson, hours: normalizeHours(lesson.hours) };
      return { ...lesson, marks: { ...lesson.marks, [field]: normalizeMark(lesson.marks[field]) } };
    });
    persist(id);
  }

  function savedBody(id: string): LessonBody | null {
    const raw = saved.current.get(id);
    if (!raw) return null;
    return JSON.parse(raw) as LessonBody;
  }

  function persist(id: string) {
    const prev = tails.current.get(id) ?? Promise.resolve();
    const next = prev.then(() => write(id), () => write(id));
    tails.current.set(id, next);
  }

  async function write(id: string) {
    const draft = lessonsRef.current.find((lesson) => lesson.id === id);
    if (!draft) return;
    const body = lessonBodyFromTexts(draft.name, draft.hours, draft.marks, savedBody(id));
    if (!body) return;
    const json = JSON.stringify(body);
    if (saved.current.get(id) === json) return;
    let res: Response;
    try {
      res = await fetch(`/api/study/gpa/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: json,
      });
    } catch {
      replaceLesson(id, (lesson) => ({ ...lesson, error: "Couldn't save" }));
      return;
    }
    if (!res.ok) {
      const message = res.status === 503 ? GPA_NOT_READY : await readError(res);
      if (res.status === 404) {
        const next = lessonsRef.current.filter((lesson) => lesson.id !== id);
        lessonsRef.current = next;
        setLessons(next);
        saved.current.delete(id);
        return;
      }
      replaceLesson(id, (lesson) => ({ ...lesson, error: message }));
      return;
    }
    const stored = (await res.json()) as GpaLesson;
    const canonical = snapshot(stored);
    if (canonical) saved.current.set(id, canonical);
    const current = lessonsRef.current.find((lesson) => lesson.id === id);
    if (!current?.error) return;
    const now = lessonBodyFromTexts(current.name, current.hours, current.marks, stored);
    if (now && canonical && JSON.stringify(now) === canonical) {
      replaceLesson(id, (lesson) => ({ ...lesson, error: null }));
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setAddTried(true);
    const hoursText = normalizeHours(hours);
    const body = lessonBodyFromTexts(name, hoursText, blankMarkText(), null);
    if (!body) return;
    setAdding(true);
    setAddError(null);
    let res: Response;
    try {
      res = await fetch("/api/study/gpa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setAdding(false);
      setAddError("Couldn't save");
      return;
    }
    setAdding(false);
    if (!res.ok) {
      setAddError(res.status === 503 ? GPA_NOT_READY : await readError(res));
      return;
    }
    const created = (await res.json()) as GpaLesson;
    const draft = draftFrom(created);
    const next = [...lessonsRef.current, draft];
    lessonsRef.current = next;
    setLessons(next);
    const json = snapshot(created);
    if (json) saved.current.set(created.id, json);
    setName("");
    setHours("");
    setAddTried(false);
  }

  async function remove(id: string) {
    setRemoving(id);
    let res: Response;
    try {
      res = await fetch(`/api/study/gpa/${id}`, { method: "DELETE" });
    } catch {
      setRemoving(null);
      replaceLesson(id, (lesson) => ({ ...lesson, error: "Couldn't remove" }));
      return;
    }
    setRemoving(null);
    if (!res.ok && res.status !== 404) {
      const message = await readError(res);
      replaceLesson(id, (lesson) => ({ ...lesson, error: message }));
      setConfirming(null);
      return;
    }
    const next = lessonsRef.current.filter((lesson) => lesson.id !== id);
    lessonsRef.current = next;
    setLessons(next);
    saved.current.delete(id);
    setConfirming(null);
  }

  const rows = lessons.map((lesson) => ({ lesson, input: scoreInput(lesson.hours, lesson.marks) }));
  const inputs = rows.map((row) => row.input);
  const first = halfScore(inputs, "first");
  const second = halfScore(inputs, "second");
  const year = yearScore(first.average, second.average);
  const entered = inputs.reduce((sum, lesson) => sum + (lesson.hours > 0 ? lesson.hours : 0), 0);
  const addNameError = addTried ? nameError(name, true) : null;
  const addHoursError = addTried ? hoursError(hours, true) : null;

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 text-white rounded-xl px-5 py-4 flex items-end justify-between gap-x-8 gap-y-4 flex-wrap">
        <div>
          <p className="text-4xl font-bold leading-none">{figure(year)}</p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mt-1">Year</p>
        </div>
        <div className="flex gap-8">
          <HalfReadout label="First half" score={first} entered={entered} />
          <HalfReadout label="Second half" score={second} entered={entered} />
        </div>
      </div>

      {first.average !== null && second.average === null && (
        <p className="text-sm text-gray-500">The year is the first half until the second half has a mark.</p>
      )}
      {first.average === null && second.average !== null && (
        <p className="text-sm text-gray-500">The year is the second half until the first half has a mark.</p>
      )}

      {lessons.length === 0 && (
        <p className="text-sm text-gray-500">Add a lesson, then its hours and its marks.</p>
      )}

      {rows.map(({ lesson, input }, index) => {
        const score = lessonScore(input);
        return (
          <article key={lesson.id} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2 w-full sm:w-auto sm:flex-1 min-w-0">
                <span className="self-end pb-2.5 text-xs text-gray-400 w-6 shrink-0 tabular-nums" aria-hidden>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
                  <Field
                    id={`${lesson.id}-name`}
                    label="Lesson"
                    value={lesson.name}
                    error={nameError(lesson.name, touched.has(`${lesson.id}:name`))}
                    onChange={(value) => edit(lesson.id, "name", value)}
                    onBlur={() => commit(lesson.id, "name")}
                    maxLength={NAME_MAX}
                  />
                  <Field
                    id={`${lesson.id}-hours`}
                    label="Hours"
                    value={lesson.hours}
                    error={hoursError(lesson.hours, touched.has(`${lesson.id}:hours`))}
                    onChange={(value) => edit(lesson.id, "hours", value)}
                    onBlur={() => commit(lesson.id, "hours")}
                    numeric
                  />
                </div>
              </div>
              <div className="flex items-start gap-4 ml-auto">
                <div className="text-right">
                  <p className="text-2xl font-bold leading-none">{figure(score.average)}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mt-1">Average</p>
                </div>
                {confirming === lesson.id ? (
                  <div className="flex flex-col items-end gap-1.5">
                    <p className="text-xs text-red-600">This drops its marks.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => remove(lesson.id)}
                        disabled={removing === lesson.id}
                        className="bg-red-600 text-white px-3 py-2 max-sm:py-2.5 rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {removing === lesson.id ? "Removing…" : "Remove"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="border border-gray-200 text-gray-600 px-3 py-2 max-sm:py-2.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(lesson.id)}
                    className="text-xs font-semibold text-gray-500 hover:text-red-600 px-2 py-2 max-sm:py-2.5"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {lesson.error && <p className="text-xs text-red-600 mt-2 ml-8">{lesson.error}</p>}

            <div className="divide-y divide-gray-100 mt-4">
              <div className="pb-4">
                <HalfFields
                  title="First half"
                  average={score.first}
                  weighted={score.firstWeighted}
                  keys={MARK_FIELDS.map((field) => field.h1)}
                  lesson={lesson}
                  onChange={(key, value) => edit(lesson.id, key, value)}
                  onBlur={(key) => commit(lesson.id, key)}
                />
              </div>
              <div className="pt-4">
                <HalfFields
                  title="Second half"
                  average={score.second}
                  weighted={score.secondWeighted}
                  keys={MARK_FIELDS.map((field) => field.h2)}
                  lesson={lesson}
                  onChange={(key, value) => edit(lesson.id, key, value)}
                  onBlur={(key) => commit(lesson.id, key)}
                />
              </div>
            </div>
          </article>
        );
      })}

      <form onSubmit={add} autoComplete="off" className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">New lesson</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 flex-1 min-w-40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Lesson</span>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setAddError(null); }}
              maxLength={NAME_MAX}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 w-28">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Hours</span>
            <input
              type="text"
              inputMode="decimal"
              value={hours}
              onChange={(e) => { setHours(e.target.value); setAddError(null); }}
              onBlur={() => setHours(normalizeHours(hours))}
              autoComplete="off"
              spellCheck={false}
              className={inputCls}
            />
          </label>
          <button
            type="submit"
            disabled={adding || (name.trim() === "" && hours.trim() === "")}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 max-sm:py-3 max-sm:w-full max-sm:justify-center rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> {adding ? "Adding…" : "Add lesson"}
          </button>
        </div>
        {addNameError && <p className="text-xs text-red-600 mt-2">{addNameError}</p>}
        {addHoursError && <p className="text-xs text-red-600 mt-2">{addHoursError}</p>}
        {addError && <p className="text-xs text-red-600 mt-2">{addError}</p>}
      </form>
    </div>
  );
}

function HalfReadout({ label, score, entered }: { label: string; score: HalfScore; entered: number }) {
  return (
    <div>
      <p className="text-2xl font-bold leading-none">{figure(score.average)}</p>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mt-1">{label}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{hoursLine(score, entered)}</p>
    </div>
  );
}

function HalfFields({
  title, average, weighted, keys, lesson, onChange, onBlur,
}: {
  title: string;
  average: number | null;
  weighted: number | null;
  keys: readonly MarkKey[];
  lesson: Draft;
  onChange: (key: MarkKey, value: string) => void;
  onBlur: (key: MarkKey) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{title}</p>
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{figure(average)}</span>
          {weighted !== null && <span className="text-gray-500 ml-2">weighted {formatMark(weighted)}</span>}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {keys.map((key) => {
          const label = MARK_FIELDS.find((field) => field.h1 === key || field.h2 === key)?.label ?? key;
          return (
            <Field
              key={key}
              id={`${lesson.id}-${key}`}
              label={label}
              value={lesson.marks[key]}
              error={parseMarkText(lesson.marks[key]).state === "bad" ? MARK_ERROR : null}
              onChange={(value) => onChange(key, value)}
              onBlur={() => onBlur(key)}
              numeric
            />
          );
        })}
      </div>
    </div>
  );
}

function Field({
  id, label, value, error, onChange, onBlur, numeric, maxLength,
}: {
  id: string;
  label: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onBlur: () => void;
  numeric?: boolean;
  maxLength?: number;
}) {
  const errorId = `${id}-error`;
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        inputMode={numeric ? "decimal" : undefined}
        autoComplete="off"
        spellCheck={false}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputCls}
      />
      {error && <span id={errorId} className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
