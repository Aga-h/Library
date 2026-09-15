import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";

async function DELETEHandler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.additionalIncome.delete({ where: { id } });
  revalidateTag("finance-stats", "max");
  return NextResponse.json({ success: true });
}

export const DELETE = withErrors(DELETEHandler);
