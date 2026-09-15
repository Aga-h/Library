import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ id: string }> };

async function POSTHandler(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const garment = await db.garment.update({
    where: { id },
    data: { wornCount: 0, lastWashed: new Date() },
  });
  return NextResponse.json(garment);
}

export const POST = withErrors(POSTHandler);
