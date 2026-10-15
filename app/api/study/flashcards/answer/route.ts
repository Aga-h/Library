import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { FlashcardError, answerCard, deck } from "@/lib/flashcard-service";

const schema = z.object({
  cardId: z.string().min(1),
  /** 1 Again, 2 Hard, 3 Good, 4 Easy. */
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  /** The card's reps when it was shown — a second answer to the same showing is refused. */
  reps: z.number().int().min(0),
});

/** Answer a card; returns the deck as it now stands, with the next card. */
async function POSTHandler(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  try {
    await answerCard(parsed.data.cardId, parsed.data.rating, parsed.data.reps);
  } catch (e) {
    // Already answered (a double tap): not an error worth showing — just carry on from here.
    if (e instanceof FlashcardError && e.status === 409) return NextResponse.json(await deck());
    if (e instanceof FlashcardError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  return NextResponse.json(await deck());
}

export const POST = withErrors(POSTHandler);
