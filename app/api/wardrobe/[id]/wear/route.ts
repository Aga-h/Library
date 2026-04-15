import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const garment = await db.garment.update({
    where: { id },
    data: { wornCount: { increment: 1 } },
  });
  return NextResponse.json(garment);
}
