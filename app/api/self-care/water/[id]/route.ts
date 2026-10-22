import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";
import { isNotFound } from "@/lib/prisma-errors";

/** Take back a water entry logged by mistake. */
async function DELETEHandler(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.waterIntake.delete({ where: { id } });
  } catch (e) {
    if (isNotFound(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
  return NextResponse.json({ success: true });
}

export const DELETE = withErrors(DELETEHandler);
