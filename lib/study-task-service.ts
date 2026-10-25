// Planner rows. The rules live in lib/study-tasks.ts; this file only reads and writes them.
// One person uses the site, so tasks are not scoped to an account — the session gate is the
// same one every other study route already sits behind.

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fromKey, isDateKey, toKey } from "@/lib/dates";
import { isMissingTable, isNotFound, isUniqueViolation } from "@/lib/prisma-errors";
import {
  nextColor,
  nextCompletedAt,
  nextDeadline,
  type LabelRef,
  type StudyLabel,
  type StudyTask,
  type TaskPatch,
  type TaskPriority,
  type TaskStatus,
  type TaskWrite,
} from "@/lib/study-tasks";

type Tx = Prisma.TransactionClient;
type LabelKind = "subject" | "category";

export class PlannerError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PlannerError";
    this.status = status;
  }
}

export interface PlannerSnapshot {
  tasks: StudyTask[];
  subjects: StudyLabel[];
  categories: StudyLabel[];
}

/** What a thrown error should say to the client, or null when the route should let it propagate. */
export function plannerFailure(error: unknown): { error: string; status: number } | null {
  if (error instanceof PlannerError) return { error: error.message, status: error.status };
  if (isMissingTable(error)) {
    return { error: "Study planner isn't set up yet. Run 039-study-tasks.sql.", status: 503 };
  }
  return null;
}

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  categoryId: string | null;
  dueDate: Date | null;
  dueTime: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  createdAt: Date;
  completedAt: Date | null;
  subtasks: { id: string; title: string; done: boolean; position: number }[];
};

function toTask(row: TaskRow): StudyTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subjectId: row.subjectId,
    categoryId: row.categoryId,
    dueDate: row.dueDate ? toKey(row.dueDate) : null,
    dueTime: row.dueTime,
    priority: row.priority,
    status: row.status,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    subtasks: [...row.subtasks]
      .sort((a, b) => a.position - b.position)
      .map((step) => ({ id: step.id, title: step.title, done: step.done, position: step.position })),
  };
}

function toLabel(row: { id: string; name: string; color: string | null; position: number }): StudyLabel {
  return { id: row.id, name: row.name, color: row.color, position: row.position };
}

const taskInclude = { subtasks: { orderBy: { position: "asc" as const } } };

/**
 * Everything the planner page shows. Null until migration 039 has run, so the rest of Study
 * keeps working and the planner page can say what is waiting.
 */
export async function loadPlanner(): Promise<PlannerSnapshot | null> {
  try {
    const [tasks, subjects, categories] = await Promise.all([
      db.studyTask.findMany({ include: taskInclude, orderBy: { createdAt: "desc" } }),
      db.studySubject.findMany({ orderBy: { name: "asc" } }),
      db.studyCategory.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
    ]);
    return {
      tasks: tasks.map((row) => toTask(row)),
      subjects: subjects.map(toLabel),
      categories: categories.map(toLabel),
    };
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

async function findNamed(tx: Tx, kind: LabelKind, name: string) {
  const where = { name: { equals: name, mode: "insensitive" as const } };
  if (kind === "subject") return tx.studySubject.findFirst({ where });
  return tx.studyCategory.findFirst({ where });
}

async function findLabel(tx: Tx, kind: LabelKind, id: string) {
  if (kind === "subject") return tx.studySubject.findUnique({ where: { id } });
  return tx.studyCategory.findUnique({ where: { id } });
}

async function insertLabel(tx: Tx, kind: LabelKind, name: string, color: LabelRef["color"]) {
  const rows = kind === "subject"
    ? await tx.studySubject.findMany({ select: { color: true, position: true } })
    : await tx.studyCategory.findMany({ select: { color: true, position: true } });
  const position = rows.reduce((max, row) => Math.max(max, row.position), -1) + 1;
  const chosen = color ?? nextColor(rows.map((row) => row.color));
  const data = { name, color: chosen, position };
  try {
    if (kind === "subject") return await tx.studySubject.create({ data });
    return await tx.studyCategory.create({ data });
  } catch (error) {
    if (isUniqueViolation(error)) throw new PlannerError(`"${name}" already exists`, 409);
    throw error;
  }
}

/** A typed name finds the existing label, whatever the case, or creates it. An id must exist. */
async function attachLabel(tx: Tx, kind: LabelKind, spec: LabelRef): Promise<string | null> {
  if (spec.name) {
    const existing = await findNamed(tx, kind, spec.name);
    if (existing) return existing.id;
    return (await insertLabel(tx, kind, spec.name, spec.color)).id;
  }
  if (spec.id) {
    const row = await findLabel(tx, kind, spec.id);
    if (!row) throw new PlannerError(kind === "subject" ? "Subject not found" : "Category not found", 404);
    return spec.id;
  }
  return null;
}

async function readTask(tx: Tx, id: string): Promise<StudyTask> {
  const row = await tx.studyTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
  return toTask(row);
}

export async function createTask(write: TaskWrite): Promise<StudyTask> {
  if (write.dueTime && !write.dueDate) throw new PlannerError("A time needs a date", 400);
  return db.$transaction(async (tx) => {
    const subjectId = write.subject ? await attachLabel(tx, "subject", write.subject) : null;
    const categoryId = write.category ? await attachLabel(tx, "category", write.category) : null;
    const now = new Date();
    const row = await tx.studyTask.create({
      data: {
        title: write.title,
        description: write.description,
        subjectId,
        categoryId,
        dueDate: write.dueDate ? fromKey(write.dueDate) : null,
        dueTime: write.dueTime,
        priority: write.priority,
        status: write.status,
        tags: write.tags,
        completedAt: write.status === "COMPLETED" ? now : null,
        subtasks: {
          create: write.subtasks.map((step, index) => ({ title: step.title, done: step.done, position: index })),
        },
      },
      include: taskInclude,
    });
    return toTask(row);
  });
}

export async function updateTask(id: string, patch: TaskPatch): Promise<StudyTask> {
  return db.$transaction(async (tx) => {
    const existing = await tx.studyTask.findUnique({ where: { id }, include: taskInclude });
    if (!existing) throw new PlannerError("Task not found", 404);
    const current = toTask(existing);

    const deadline = nextDeadline(current, patch);
    if ("error" in deadline) throw new PlannerError(deadline.error, 400);

    const subjectId = patch.subject ? await attachLabel(tx, "subject", patch.subject) : undefined;
    const categoryId = patch.category ? await attachLabel(tx, "category", patch.category) : undefined;
    const now = new Date();

    await tx.studyTask.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.dueDate !== undefined || patch.dueTime !== undefined
          ? {
              dueDate: deadline.dueDate && isDateKey(deadline.dueDate) ? fromKey(deadline.dueDate) : null,
              dueTime: deadline.dueTime,
            }
          : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.status !== undefined
          ? {
              status: patch.status,
              completedAt: (() => {
                const iso = nextCompletedAt(current, patch.status!, now.toISOString());
                return iso ? new Date(iso) : null;
              })(),
            }
          : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(subjectId !== undefined ? { subjectId } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
      },
    });

    if (patch.subtask) {
      const updated = await tx.studySubtask.updateMany({
        where: { id: patch.subtask.id, taskId: id },
        data: { done: patch.subtask.done },
      });
      if (updated.count !== 1) throw new PlannerError("That step isn't on this task", 404);
    }

    if (patch.subtasks) {
      const kept = patch.subtasks.flatMap((step) => (step.id ? [step.id] : []));
      await tx.studySubtask.deleteMany({
        where: kept.length > 0 ? { taskId: id, id: { notIn: kept } } : { taskId: id },
      });
      for (const [index, step] of patch.subtasks.entries()) {
        if (step.id) {
          const updated = await tx.studySubtask.updateMany({
            where: { id: step.id, taskId: id },
            data: { title: step.title, done: step.done, position: index },
          });
          if (updated.count !== 1) throw new PlannerError("That step isn't on this task", 400);
        } else {
          await tx.studySubtask.create({
            data: { taskId: id, title: step.title, done: step.done, position: index },
          });
        }
      }
    }

    return readTask(tx, id);
  });
}

export async function deleteTask(id: string): Promise<void> {
  try {
    await db.studyTask.delete({ where: { id } });
  } catch (error) {
    if (isNotFound(error)) throw new PlannerError("Task not found", 404);
    throw error;
  }
}

function missingLabel(kind: LabelKind): string {
  return kind === "subject" ? "Subject not found" : "Category not found";
}

export async function createLabel(kind: LabelKind, name: string, color: LabelRef["color"]): Promise<StudyLabel> {
  return db.$transaction(async (tx) => {
    const existing = await findNamed(tx, kind, name);
    if (existing) throw new PlannerError(`"${existing.name}" already exists`, 409);
    return toLabel(await insertLabel(tx, kind, name, color));
  });
}

export async function updateLabel(
  kind: LabelKind,
  id: string,
  patch: { name?: string; color?: string | null },
): Promise<StudyLabel> {
  return db.$transaction(async (tx) => {
    const current = await findLabel(tx, kind, id);
    if (!current) throw new PlannerError(missingLabel(kind), 404);
    if (patch.name) {
      const other = await findNamed(tx, kind, patch.name);
      if (other && other.id !== id) throw new PlannerError(`"${other.name}" already exists`, 409);
    }
    try {
      const data = {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.color !== undefined ? { color: patch.color } : {}),
      };
      if (kind === "subject") return toLabel(await tx.studySubject.update({ where: { id }, data }));
      return toLabel(await tx.studyCategory.update({ where: { id }, data }));
    } catch (error) {
      if (isUniqueViolation(error)) throw new PlannerError(`"${patch.name ?? current.name}" already exists`, 409);
      if (isNotFound(error)) throw new PlannerError(missingLabel(kind), 404);
      throw error;
    }
  });
}

export async function deleteLabel(kind: LabelKind, id: string): Promise<void> {
  try {
    if (kind === "subject") await db.studySubject.delete({ where: { id } });
    else await db.studyCategory.delete({ where: { id } });
  } catch (error) {
    if (isNotFound(error)) throw new PlannerError(missingLabel(kind), 404);
    throw error;
  }
}
