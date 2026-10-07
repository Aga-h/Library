export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { groupByCategory, hostOf, lineCodes, lineHue, stationCode } from "@/lib/shopping";
import { ShopNote } from "@/components/shopping/ShopLines";
import ProductList from "@/components/shopping/ProductList";

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [shop, all] = await Promise.all([
    db.shop.findUnique({ where: { id }, include: { products: { orderBy: { createdAt: "asc" } } } }),
    db.shop.findMany(),
  ]);
  if (!shop) notFound();

  // The same station code the shop has on the map.
  const lines = groupByCategory(all);
  const code = lineCodes(lines.map((l) => l.category)).get(shop.category)!;
  const station = stationCode(code, lines.find((l) => l.category === shop.category)!.shops.findIndex((s) => s.id === shop.id));

  return (
    <div className="shop-page max-w-3xl mx-auto space-y-6" style={{ "--line": `var(--color-${lineHue(shop.category)}-500)` } as React.CSSProperties}>
      <Link href="/shopping" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Shopping
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="shop-page-line flex items-center gap-2 text-xs font-semibold text-gray-500 mb-1">
            <span aria-hidden className="w-2.5 h-2.5 rounded-full bg-(--line)" />
            <span className="shop-code font-mono">{station}</span>
            <Link href={`/shopping?category=${encodeURIComponent(shop.category)}`} className="hover:text-gray-800">{shop.category}</Link>
          </p>
          <h2 className="text-2xl font-bold text-gray-900 break-words">{shop.name}</h2>
          <a href={shop.url} target="_blank" rel="noopener noreferrer"
            className="shop-host inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mt-0.5">
            {hostOf(shop.url)} <ExternalLink aria-hidden className="w-3.5 h-3.5" />
            <span className="sr-only">(opens the shop&apos;s site)</span>
          </a>
        </div>
        <Link href={`/shopping/${shop.id}/edit`}
          className="flex items-center gap-1.5 border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
          <Pencil className="w-4 h-4" /> Edit shop
        </Link>
      </div>

      <section aria-labelledby="shop-notes" className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 id="shop-notes" className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">The shop</h3>
        {shop.liked || shop.disliked ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {shop.liked && <ShopNote kind="liked" text={shop.liked} />}
            {shop.disliked && <ShopNote kind="disliked" text={shop.disliked} />}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No notes on the shop yet — <Link href={`/shopping/${shop.id}/edit`} className="underline underline-offset-2">edit it</Link> to add what you liked and didn&apos;t.</p>
        )}
      </section>

      <section aria-labelledby="shop-products" className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 id="shop-products" className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Products{shop.products.length > 0 && ` · ${shop.products.length}`}
        </h3>
        <ProductList shopId={shop.id} products={shop.products.map((p) => ({ id: p.id, name: p.name, comment: p.comment }))} />
      </section>
    </div>
  );
}
