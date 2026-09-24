import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { importBuiltinList, importWordList } from "@/lib/vocab-service";

const schema = z.union([
  z.object({ builtin: z.literal(true) }),
  z.object({ text: z.string().min(1, "Paste a word list first") }),
]);

/**
 * Imports a word list: either the one that ships with the repo, or a pasted one.
 *
 * Re-importing is a no-op rather than a duplicate, so corrections can just be re-imported.
 */
async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }

  const summary = "builtin" in result.data
    ? await importBuiltinList()
    : await importWordList(result.data.text);

  // Nothing read at all -- as opposed to read and found unchanged, which is a success.
  if (summary.wordsAdded + summary.wordsUpdated + summary.wordsUnchanged === 0) {
    return NextResponse.json(
      { error: "No words could be read. Each line needs a word, a separator (— : - or tab) and a meaning.", summary },
      { status: 400 },
    );
  }
  return NextResponse.json(summary, { status: 201 });
}

export const POST = withErrors(POSTHandler);
