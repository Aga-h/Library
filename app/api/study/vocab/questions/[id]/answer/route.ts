import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { answerQuestion } from "@/lib/vocab-service";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({ chosenId: z.string().min(1) });

/** Which option was picked. Correctness is decided here, not by the client. */
async function POSTHandler(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const result = schema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }

  const outcome = await answerQuestion(id, result.data.chosenId);
  if (!outcome) return NextResponse.json({ error: "No such question, or that option is not on it" }, { status: 400 });
  return NextResponse.json(outcome);
}

export const POST = withErrors(POSTHandler);
