import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.additionalIncome.delete({ where: { id } });
  revalidateTag("finance-stats", "max");
  return NextResponse.json({ success: true });
}
