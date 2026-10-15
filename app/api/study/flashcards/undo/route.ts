import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { deck, undoLast } from "@/lib/flashcard-service";

/** Take back today's last answer. */
async function POSTHandler() {
  if (!(await undoLast())) return NextResponse.json({ error: "Nothing to undo today." }, { status: 400 });
  return NextResponse.json(await deck());
}

export const POST = withErrors(POSTHandler);
