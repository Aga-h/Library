import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readJson, withErrors } from "@/lib/api-errors";
import { isForeignKeyViolation } from "@/lib/prisma-errors";
import { createProductSchema, firstIssue } from "../../schema";

type RouteContext = { params: Promise<{ id: string }> };

async function GETHandler(_: Request, { params }: RouteContext) {
  const { id } = await params;
  const products = await db.shopProduct.findMany({ where: { shopId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(products);
}

async function POSTHandler(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const body = await readJson(request);
  if (body === null) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const result = createProductSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: firstIssue(result.error) }, { status: 400 });
  try {
    const product = await db.shopProduct.create({ data: { shopId: id, ...result.data } });
    return NextResponse.json(product, { status: 201 });
  } catch (e) {
    // The shop isn't there (or was deleted while the form was open).
    if (isForeignKeyViolation(e)) return NextResponse.json({ error: "That shop no longer exists" }, { status: 404 });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
