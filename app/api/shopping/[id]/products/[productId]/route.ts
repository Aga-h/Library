import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readJson, withErrors } from "@/lib/api-errors";
import { isNotFound } from "@/lib/prisma-errors";
import { firstIssue, updateProductSchema } from "../../../schema";

type RouteContext = { params: Promise<{ id: string; productId: string }> };

// Every write is scoped to the shop in the path, so a product can only be changed through its own
// shop's address.

async function PATCHHandler(request: Request, { params }: RouteContext) {
  const { id, productId } = await params;
  const body = await readJson(request);
  if (body === null) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const result = updateProductSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: firstIssue(result.error) }, { status: 400 });
  try {
    const product = await db.shopProduct.update({ where: { id: productId, shopId: id }, data: result.data });
    return NextResponse.json(product);
  } catch (e) {
    if (isNotFound(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}

async function DELETEHandler(_: Request, { params }: RouteContext) {
  const { id, productId } = await params;
  try {
    await db.shopProduct.delete({ where: { id: productId, shopId: id } });
  } catch (e) {
    if (isNotFound(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}

export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
