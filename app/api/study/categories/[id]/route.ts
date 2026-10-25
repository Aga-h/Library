import { NextRequest, NextResponse } from "next/server";
import { readJson, withErrors } from "@/lib/api-errors";
import { deleteLabel, plannerFailure, updateLabel } from "@/lib/study-task-service";
import { parseLabelPatch } from "@/lib/study-tasks";

type RouteContext = { params: Promise<{ id: string }> };

function failed(error: unknown): Response | null {
  const result = plannerFailure(error);
  return result ? NextResponse.json({ error: result.error }, { status: result.status }) : null;
}

async function PATCHHandler(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const parsed = parseLabelPatch(await readJson(request));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    return NextResponse.json(await updateLabel("category", id, parsed.value));
  } catch (error) {
    const response = failed(error);
    if (response) return response;
    throw error;
  }
}

async function DELETEHandler(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    await deleteLabel("category", id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = failed(error);
    if (response) return response;
    throw error;
  }
}

export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
