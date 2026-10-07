import Link from "next/link";
import { ArrowRight, ExternalLink, Plus } from "lucide-react";
import { hostOf } from "@/lib/shopping";

export interface ShopLine {
  category: string;
  /** The line's code, like a metro line's letter: "C". */
  code: string;
  /** Palette hue the line is drawn in, so each look recolours it. */
  hue: string;
  shops: {
    id: string;
    name: string;
    url: string;
    liked: string | null;
    disliked: string | null;
    products: { id: string; name: string; comment: string | null }[];
    /** The shop's code on its line: "C03". */
    station: string;
  }[];
}

/**
 * Every category as a line on a map, and its shops as the stations along it — like the strip map
 * over a train door. The line colour comes from the palette (`--line`), so each look recolours it.
 */
export default function ShopLines({ lines }: { lines: ShopLine[] }) {
  return (
    <div className="shop-map space-y-10">
      {lines.map((line) => (
        <section key={line.category} aria-labelledby={`line-${line.code}`} className="shop-line"
          style={{ "--line": `var(--color-${line.hue}-500)` } as React.CSSProperties}>
          <div className="shop-line-head flex items-center gap-3 mb-4">
            <span aria-hidden className="shop-line-bullet flex items-center justify-center min-w-8 h-8 px-1.5 rounded-full bg-(--line) text-xs font-bold text-white">
              {line.code}
            </span>
            <h3 id={`line-${line.code}`} className="text-lg font-semibold text-gray-900">{line.category}</h3>
            <span className="shop-line-count text-xs text-gray-400">
              {line.shops.length} shop{line.shops.length === 1 ? "" : "s"}
            </span>
          </div>
          <ol className="shop-stops relative ml-4 pl-8 border-l-4 border-(color:--line) space-y-3">
            {line.shops.map((shop, i) => (
              <li key={shop.id} className="shop-stop relative bg-white border border-gray-200 rounded-xl p-4"
                style={{ "--i": i } as React.CSSProperties}>
                <span aria-hidden className="shop-dot absolute -left-[44px] top-5 w-5 h-5 rounded-full bg-white border-4 border-(color:--line)" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="shop-code text-[11px] font-mono font-semibold text-gray-400">{shop.station}</span>
                      <a href={shop.url} target="_blank" rel="noopener noreferrer"
                        className="shop-name inline-flex items-center gap-1.5 font-semibold text-gray-900 hover:underline">
                        {shop.name}
                        <ExternalLink aria-hidden className="w-3.5 h-3.5 text-gray-400" />
                        <span className="sr-only">(opens the shop&apos;s site)</span>
                      </a>
                    </div>
                    <p className="shop-host text-xs text-gray-500 truncate">{hostOf(shop.url)}</p>
                  </div>
                  <Link href={`/shopping/${shop.id}`} aria-label={`Open ${shop.name}`}
                    className="shop-open p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                {shop.liked || shop.disliked ? (
                  <div className="grid sm:grid-cols-2 gap-4 mt-3">
                    {shop.liked && <ShopNote kind="liked" text={shop.liked} />}
                    {shop.disliked && <ShopNote kind="disliked" text={shop.disliked} />}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-2">No notes yet.</p>
                )}
                {shop.products.length > 0 && (
                  <div className="shop-products mt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Products</p>
                    <ul className="space-y-1">
                      {shop.products.map((p) => (
                        <li key={p.id} className="shop-products-item text-sm line-clamp-2 break-words">
                          <span className="font-medium text-gray-900">{p.name}</span>
                          {p.comment && <span className="text-gray-500"> — {p.comment}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Link href={`/shopping/${shop.id}#add-product`}
                  className="shop-add-product inline-flex items-center gap-1 mt-3 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors">
                  <Plus aria-hidden className="w-3.5 h-3.5" /> Add a product
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** What you liked or didn't, under its label — on the map and on the shop's page. */
export function ShopNote({ kind, text }: { kind: "liked" | "disliked"; text: string }) {
  const liked = kind === "liked";
  return (
    <div className={`shop-note shop-note-${kind}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${liked ? "text-green-700" : "text-red-700"}`}>
        {liked ? "Liked" : "Didn't like"}
      </p>
      <p className="text-sm text-gray-700 whitespace-pre-line break-words">{text}</p>
    </div>
  );
}
