import { NextRequest, NextResponse } from "next/server";
import { readJson, withErrors } from "@/lib/api-errors";
import { isMissingTable } from "@/lib/prisma-errors";
import { verifyFriendToken } from "@/lib/session";
import { SHARE_NOT_READY, inboxSchema } from "@/lib/media-share";
import { receive } from "@/lib/media-share-service";

/**
 * The friend's site sending something here, with EXCHANGE_TOKEN (docs/media-exchange.md). Answers
 * `{ dueAt }`: when it should be finished by, worked out here from its length.
 */
async function POSTHandler(request: NextRequest) {
  // The proxy lets this through on the token; the site's own session is not the friend.
  if (!(await verifyFriendToken(request.headers.get("authorization"), process.env.EXCHANGE_TOKEN))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = inboxSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const outcome = await receive(parsed.data);
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json({ dueAt: outcome.dueAt }, { status: 201 });
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ error: SHARE_NOT_READY }, { status: 503 });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
