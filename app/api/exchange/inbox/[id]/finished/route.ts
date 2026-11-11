import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJson, withErrors } from "@/lib/api-errors";
import { isMissingTable } from "@/lib/prisma-errors";
import { verifyFriendToken } from "@/lib/session";
import { SHARE_NOT_READY } from "@/lib/media-share";
import { friendFinished } from "@/lib/media-share-service";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ finishedAt: z.iso.datetime({ offset: true }) });

/** The friend's site saying they finished what was sent from here, with EXCHANGE_TOKEN. */
async function POSTHandler(request: NextRequest, { params }: RouteContext) {
  if (!(await verifyFriendToken(request.headers.get("authorization"), process.env.EXCHANGE_TOKEN))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Send finishedAt as an ISO date." }, { status: 400 });

  try {
    if (!(await friendFinished(id, new Date(parsed.data.finishedAt)))) {
      return NextResponse.json({ error: "Nothing like that was sent from here." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ error: SHARE_NOT_READY }, { status: 503 });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
