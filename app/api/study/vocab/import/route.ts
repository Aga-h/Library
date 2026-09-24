import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { importWordList } from "@/lib/vocab-service";

const schema = z.object({ text: z.string().min(1, "Paste a word list first") });

/** Paste a word list. Re-pasting the same list is a no-op, so corrections can just be re-pasted. */
async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const summary = await importWordList(result.data.text);
  if (summary.wordsAdded === 0 && summary.wordsUpdated === 0) {
    return NextResponse.json(
      { error: "No words could be read. Each line needs a word, a separator (— : or tab) and a meaning.", summary },
      { status: 400 },
    );
  }
  return NextResponse.json(summary, { status: 201 });
}

export const POST = withErrors(POSTHandler);
