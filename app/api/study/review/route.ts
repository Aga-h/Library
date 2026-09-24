import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { dailyReview } from "@/lib/review-service";
import { isDateKey, todayKey, type DateKey } from "@/lib/dates";

/**
 * One day's study review as JSON — today in Europe/Istanbul unless `?date=YYYY-MM-DD` says
 * otherwise.
 *
 * Readable with a session, or with `Authorization: Bearer <REPORT_TOKEN>` for the nightly job
 * (see proxy.ts). Read-only: nothing here writes.
 */
async function GETHandler(request: NextRequest) {
  const now = new Date();
  const raw = request.nextUrl.searchParams.get("date");
  if (raw !== null && !isDateKey(raw)) {
    return NextResponse.json({ error: "Expected ?date=YYYY-MM-DD" }, { status: 400 });
  }
  const date = (raw ?? todayKey(now)) as DateKey;
  return NextResponse.json(await dailyReview(date, now), {
    headers: { "Cache-Control": "no-store" },
  });
}

export const GET = withErrors(GETHandler);
