import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export async function GET() {
  const series = await db.tvSeries.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(series);
}

const schema = z.object({ name: z.string().min(1) });

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  try {
    const series = await db.tvSeries.create({ data: { name: result.data.name.trim() } });
    return NextResponse.json(series, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A series with that name already exists" }, { status: 409 });
  }
}
