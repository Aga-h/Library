import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";

async function POSTHandler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const now = new Date();
  let cancelledYear = now.getFullYear();
  let cancelledMonth = now.getMonth() + 2; // next month
  if (cancelledMonth > 12) { cancelledMonth = 1; cancelledYear++; }

  const subscription = await db.subscription.update({
    where: { id },
    data: { cancelledYear, cancelledMonth },
  });
  revalidateTag("finance-stats", "max");
  return NextResponse.json(subscription);
}

export const POST = withErrors(POSTHandler);
