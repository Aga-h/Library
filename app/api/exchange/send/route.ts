import { NextRequest, NextResponse } from "next/server";
import { readJson, withErrors } from "@/lib/api-errors";
import { isMissingTable } from "@/lib/prisma-errors";
import { SHARE_NOT_READY, sendSchema } from "@/lib/media-share";
import { ShareError, sendToFriend } from "@/lib/media-share-service";

export const maxDuration = 60;

/** Send something to the friend's site: `{ kind, sourceId, note? }`. Its details are read here. */
async function POSTHandler(request: NextRequest) {
  const parsed = sendSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Pick something to send." }, { status: 400 });
  const { kind, sourceId, note } = parsed.data;

  try {
    const item = await sendToFriend(kind, sourceId, note || null);
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    if (e instanceof ShareError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (isMissingTable(e)) return NextResponse.json({ error: SHARE_NOT_READY }, { status: 503 });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
