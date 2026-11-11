import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { isMissingTable } from "@/lib/prisma-errors";
import { SHARE_NOT_READY } from "@/lib/media-share";
import { finishReceived } from "@/lib/media-share-service";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Mark what the friend sent as finished and tell their site. Again on a finished one only retries
 * telling them; `notifiedAt` in the answer says whether it got through.
 */
async function POSTHandler(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const item = await finishReceived(id);
    if (!item) return NextResponse.json({ error: "Nothing like that came from them." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ error: SHARE_NOT_READY }, { status: 503 });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
