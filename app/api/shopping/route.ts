import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readJson, withErrors } from "@/lib/api-errors";
import { canonicalCategory } from "@/lib/shopping";
import { categoriesInUse } from "@/lib/shopping-service";
import { createShopSchema, firstIssue } from "./schema";

async function GETHandler() {
  const shops = await db.shop.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  return NextResponse.json(shops);
}

async function POSTHandler(request: Request) {
  const body = await readJson(request);
  if (body === null) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const result = createShopSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: firstIssue(result.error) }, { status: 400 });
  const d = result.data;
  const shop = await db.shop.create({
    data: { ...d, category: canonicalCategory(d.category, await categoriesInUse()) },
  });
  return NextResponse.json(shop, { status: 201 });
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
