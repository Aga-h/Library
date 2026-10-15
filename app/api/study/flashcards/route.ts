import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { deck } from "@/lib/flashcard-service";

/** Today's flashcards: the numbers, and the card to study now. */
async function GETHandler() {
  return NextResponse.json(await deck());
}

export const GET = withErrors(GETHandler);
