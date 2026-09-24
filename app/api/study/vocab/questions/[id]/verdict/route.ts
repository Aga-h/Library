import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { setVerdict } from "@/lib/vocab-service";

type RouteContext = { params: Promise<{ id: string }> };

// To Review is not offered: a wrong answer is filed there automatically and a right one cannot
// be sent there by hand.
const schema = z.object({ verdict: z.enum(["DONE", "AMBIGUOUS"]) });

async function POSTHandler(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const result = schema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }

  const ok = await setVerdict(id, result.data.verdict);
  if (!ok) return NextResponse.json({ error: "That question was not answered correctly" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export const POST = withErrors(POSTHandler);
