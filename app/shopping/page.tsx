export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus, ShoppingBag } from "lucide-react";
import { db } from "@/lib/db";
import { filterShops, groupByCategory, lineCodes, lineHue, stationCode } from "@/lib/shopping";
import ShopLines from "@/components/shopping/ShopLines";
import ShopSearch from "@/components/shopping/ShopSearch";

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q = "" } = await searchParams;
  const shops = await db.shop.findMany();

  // Codes come from the whole map, not the filtered view, so a shop keeps its station code
  // (C03) however the list is searched.
  const allLines = groupByCategory(shops);
  const codes = lineCodes(allLines.map((l) => l.category));
  const stations = new Map<string, string>();
  for (const line of allLines) line.shops.forEach((s, i) => stations.set(s.id, stationCode(codes.get(line.category)!, i)));

  const activeCategory = allLines.some((l) => l.category === category) ? category : undefined;
  const lines = groupByCategory(filterShops(shops, { q, category: activeCategory })).map((line) => ({
    category: line.category,
    code: codes.get(line.category)!,
    hue: lineHue(line.category),
    shops: line.shops.map((s) => ({ ...s, station: stations.get(s.id)! })),
  }));

  const href = (c?: string, search = q) => {
    const params = new URLSearchParams();
    if (c) params.set("category", c);
    if (search) params.set("q", search);
    const qs = params.toString();
    return qs ? `/shopping?${qs}` : "/shopping";
  };
  const clearSearchHref = href(activeCategory, "");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Shops</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {shops.length === 0
              ? "Shops you have tried, and what you thought of them"
              : `${shops.length} shop${shops.length === 1 ? "" : "s"} in ${allLines.length} categor${allLines.length === 1 ? "y" : "ies"}`}
          </p>
        </div>
        <Link
          href="/shopping/new"
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add shop
        </Link>
      </div>

      {shops.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No shops yet</p>
          <p className="text-sm mt-1">Add a shop&apos;s website, file it under a category, and note what was good and what wasn&apos;t.</p>
          <Link href="/shopping/new" className="inline-block mt-4 text-sm font-semibold text-gray-900 underline underline-offset-2">
            Add your first shop
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <nav aria-label="Categories" className="shop-filters flex flex-wrap gap-2">
              <FilterChip href={href()} active={!activeCategory} label="All" count={shops.length} />
              {allLines.map((l) => (
                <FilterChip key={l.category} href={href(l.category)} active={activeCategory === l.category}
                  label={l.category} count={l.shops.length} hue={lineHue(l.category)} />
              ))}
            </nav>
            <ShopSearch defaultValue={q} />
          </div>

          {lines.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="font-medium">No shops match &ldquo;{q}&rdquo;</p>
              <Link href={clearSearchHref} className="inline-block mt-3 text-sm font-semibold text-gray-900 underline underline-offset-2">
                Clear the search
              </Link>
            </div>
          ) : (
            <ShopLines lines={lines} />
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({ href, active, label, count, hue }: { href: string; active: boolean; label: string; count: number; hue?: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={hue ? ({ "--line": `var(--color-${hue}-500)` } as React.CSSProperties) : undefined}
      className={`shop-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {hue && <span aria-hidden className="shop-chip-dot w-2 h-2 rounded-full bg-(--line)" />}
      {label}
      <span className="text-gray-400">{count}</span>
    </Link>
  );
}
