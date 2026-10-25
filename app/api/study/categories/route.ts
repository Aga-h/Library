import { NextRequest, NextResponse } from "next/server";
import { readJson, withErrors } from "@/lib/api-errors";
import { createLabel, plannerFailure } from "@/lib/study-task-service";
import { parseLabelCreate } from "@/lib/study-tasks";

async function POSTHandler(request: NextRequest) {
  const parsed = parseLabelCreate(await readJson(request));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    return NextResponse.json(await createLabel("category", parsed.value.name, parsed.value.color), { status: 201 });
  } catch (error) {
    const result = plannerFailure(error);
    if (result) return NextResponse.json({ error: result.error }, { status: result.status });
    throw error;
  }
}

export const POST = withErrors(POSTHandler);
