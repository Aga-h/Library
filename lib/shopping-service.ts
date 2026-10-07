// Shopping's database side. The rules themselves are in lib/shopping.ts.
import { db } from "@/lib/db";

/** The categories already in use, so a new shop files with them whatever case it was typed in. */
export async function categoriesInUse(): Promise<string[]> {
  const rows = await db.shop.findMany({ distinct: ["category"], select: { category: true } });
  return rows.map((r) => r.category);
}
