import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ id: string }> };

async function DELETEHandler(_r: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!(await db.schoolTerm.findUnique({ where: { id } }))) {
    return NextResponse.json({ error: "Term not found" }, { status: 404 });
  }
  // Deleting a term changes what kind its dates are; assignments are left in place and the
  // month page flags any that now sit on the wrong kind.
  await db.schoolTerm.delete({ where: { id } });
  revalidateTag("calendar", "max");
  return new NextResponse(null, { status: 204 });
}

export const DELETE = withErrors(DELETEHandler);
