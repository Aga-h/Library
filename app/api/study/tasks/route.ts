import { NextRequest, NextResponse } from "next/server";
import { readJson, withErrors } from "@/lib/api-errors";
import { createTask, loadPlanner, plannerFailure } from "@/lib/study-task-service";
import { parseTaskCreate } from "@/lib/study-tasks";

function failed(error: unknown): Response | null {
  const result = plannerFailure(error);
  return result ? NextResponse.json({ error: result.error }, { status: result.status }) : null;
}

async function GETHandler() {
  try {
    const snapshot = await loadPlanner();
    if (!snapshot) return NextResponse.json({ error: "Study planner isn't set up yet. Run 039-study-tasks.sql." }, { status: 503 });
    return NextResponse.json(snapshot);
  } catch (error) {
    const response = failed(error);
    if (response) return response;
    throw error;
  }
}

async function POSTHandler(request: NextRequest) {
  const parsed = parseTaskCreate(await readJson(request));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    return NextResponse.json(await createTask(parsed.value), { status: 201 });
  } catch (error) {
    const response = failed(error);
    if (response) return response;
    throw error;
  }
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
