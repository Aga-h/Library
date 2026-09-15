import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ id: string }> };

async function DELETEHandler(_r: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!(await db.dayOff.findUnique({ where: { id } }))) {
    return NextResponse.json({ error: "Day off not found" }, { status: 404 });
  }
  await db.dayOff.delete({ where: { id } });
  revalidateTag("calendar", "max");
  return new NextResponse(null, { status: 204 });
}

export const DELETE = withErrors(DELETEHandler);
