import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { deck, setFlashLimits } from "@/lib/flashcard-service";

const schema = z.object({
  newPerDay: z.number().int().min(0).max(9999),
  reviewsPerDay: z.number().int().min(0).max(9999),
});

/** The daily limits: new cards and reviews. */
async function PUTHandler(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  await setFlashLimits(parsed.data);
  return NextResponse.json(await deck());
}

export const PUT = withErrors(PUTHandler);
