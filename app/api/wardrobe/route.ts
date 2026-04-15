import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(["TOPS","BOTTOMS","OUTERWEAR","UNDERWEAR","SOCKS","ACTIVEWEAR","FORMALWEAR","ACCESSORIES","OTHER"]).default("OTHER"),
  brand: z.string().optional(),
  color: z.string().optional(),
  colorGroup: z.enum(["WHITE","LIGHT","DARK","VIVID","MIXED"]).default("MIXED"),
  materials: z.string().min(1),
  washMethod: z.enum(["MACHINE","HAND","DRY_CLEAN","DO_NOT_WASH"]).default("MACHINE"),
  maxTemp: z.enum(["COLD","W30","W40","W60","W90"]).default("W40"),
  washCycle: z.enum(["NORMAL","GENTLE"]).default("NORMAL"),
  spinLevel: z.enum(["NORMAL","REDUCED","NONE"]).default("NORMAL"),
  dryMethod: z.enum(["TUMBLE_HIGH","TUMBLE_MEDIUM","TUMBLE_LOW","AIR_LINE","AIR_FLAT","AIR_DRIP","DRY_CLEAN","DO_NOT_DRY"]).default("TUMBLE_LOW"),
  image: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  const garments = await db.garment.findMany({ where, orderBy: { createdAt: "desc" } });
  return NextResponse.json(garments);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  const d = result.data;
  const garment = await db.garment.create({
    data: {
      name: d.name, type: d.type, brand: d.brand ?? null, color: d.color ?? null,
      colorGroup: d.colorGroup as never, materials: d.materials,
      washMethod: d.washMethod as never, maxTemp: d.maxTemp as never,
      washCycle: d.washCycle as never, spinLevel: d.spinLevel as never,
      dryMethod: d.dryMethod as never, image: d.image || null, notes: d.notes ?? null,
    },
  });
  return NextResponse.json(garment, { status: 201 });
}
