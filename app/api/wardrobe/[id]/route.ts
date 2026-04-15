import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["TOPS","BOTTOMS","OUTERWEAR","UNDERWEAR","SOCKS","ACTIVEWEAR","FORMALWEAR","ACCESSORIES","OTHER"]).optional(),
  brand: z.string().optional(),
  color: z.string().optional(),
  colorGroup: z.enum(["WHITE","LIGHT","DARK","VIVID","MIXED"]).optional(),
  materials: z.string().min(1).optional(),
  washMethod: z.enum(["MACHINE","HAND","DRY_CLEAN","DO_NOT_WASH"]).optional(),
  maxTemp: z.enum(["COLD","W30","W40","W60","W90"]).optional(),
  washCycle: z.enum(["NORMAL","GENTLE"]).optional(),
  spinLevel: z.enum(["NORMAL","REDUCED","NONE"]).optional(),
  dryMethod: z.enum(["TUMBLE_HIGH","TUMBLE_MEDIUM","TUMBLE_LOW","AIR_LINE","AIR_FLAT","AIR_DRIP","DRY_CLEAN","DO_NOT_DRY"]).optional(),
  image: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export async function GET(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const garment = await db.garment.findUnique({ where: { id } });
  if (!garment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(garment);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await request.json();
  const result = patchSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  const garment = await db.garment.update({ where: { id }, data: result.data as never });
  return NextResponse.json(garment);
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  await db.garment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
