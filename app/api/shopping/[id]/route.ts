import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readJson, withErrors } from "@/lib/api-errors";
import { isNotFound } from "@/lib/prisma-errors";
import { canonicalCategory } from "@/lib/shopping";
import { categoriesInUse } from "@/lib/shopping-service";
import { firstIssue, updateShopSchema } from "../schema";

type RouteContext = { params: Promise<{ id: string }> };

async function GETHandler(_: Request, { params }: RouteContext) {
  const { id } = await params;
  const shop = await db.shop.findUnique({ where: { id } });
  if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(shop);
}

async function PATCHHandler(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const body = await readJson(request);
  if (body === null) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const result = updateShopSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: firstIssue(result.error) }, { status: 400 });
  const d = result.data;
  try {
    const shop = await db.shop.update({
      where: { id },
      data: { ...d, ...(d.category !== undefined && { category: canonicalCategory(d.category, await categoriesInUse()) }) },
    });
    return NextResponse.json(shop);
  } catch (e) {
    if (isNotFound(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}

async function DELETEHandler(_: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    await db.shop.delete({ where: { id } });
  } catch (e) {
    if (isNotFound(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}

export const GET = withErrors(GETHandler);
export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
