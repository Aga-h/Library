export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus, Shirt } from "lucide-react";
import { db } from "@/lib/db";
import GarmentCard from "@/components/wardrobe/GarmentCard";

type GarmentType =
  | "TOPS" | "BOTTOMS" | "OUTERWEAR" | "UNDERWEAR" | "SOCKS"
  | "ACTIVEWEAR" | "FORMALWEAR" | "ACCESSORIES" | "OTHER";

const TYPE_LABELS: Record<GarmentType, string> = {
  TOPS: "Tops", BOTTOMS: "Bottoms", OUTERWEAR: "Outerwear",
  UNDERWEAR: "Underwear", SOCKS: "Socks", ACTIVEWEAR: "Activewear",
  FORMALWEAR: "Formalwear", ACCESSORIES: "Accessories", OTHER: "Other",
};

const TYPES = Object.keys(TYPE_LABELS) as GarmentType[];

export default async function WardrobePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const activeType = TYPES.includes(type as GarmentType) ? (type as GarmentType) : undefined;

  const garments = await db.garment.findMany({
    where: activeType ? { type: activeType } : undefined,
    orderBy: { wornCount: "desc" },
  });

  const washNow = garments.filter((g) => {
    const base = g.type === "UNDERWEAR" || g.type === "SOCKS";
    return base ? g.wornCount > 0 : g.wornCount >= 5;
  }).length;
  const washSoon = garments.filter((g) => {
    const base = g.type === "UNDERWEAR" || g.type === "SOCKS";
    return !base && g.wornCount >= 3 && g.wornCount < 5;
  }).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Wardrobe</h2>
          <p className="text-sm text-gray-500 mt-0.5">{garments.length} item{garments.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/wardrobe/new"
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Garment
        </Link>
      </div>

      {/* Urgency summary */}
      {garments.length > 0 && (washNow > 0 || washSoon > 0) && (
        <div className="flex gap-3">
          {washNow > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm font-medium text-red-700">
              {washNow} item{washNow > 1 ? "s" : ""} need washing now
            </div>
          )}
          {washSoon > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm font-medium text-amber-700">
              {washSoon} item{washSoon > 1 ? "s" : ""} should be washed soon
            </div>
          )}
        </div>
      )}

      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-2">
        <FilterTab href="/wardrobe" active={!activeType} label="All" />
        {TYPES.map((t) => (
          <FilterTab key={t} href={`/wardrobe?type=${t}`} active={activeType === t} label={TYPE_LABELS[t]} />
        ))}
      </div>

      {/* Grid */}
      {garments.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Shirt className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No garments yet</p>
          <p className="text-sm mt-1">Add your first item to get washing recommendations</p>
          <Link href="/wardrobe/new" className="inline-block mt-4 text-sm font-semibold text-gray-900 underline underline-offset-2">
            Add a garment
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {garments.map((g) => (
            <GarmentCard key={g.id} garment={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? "bg-gray-900 text-white"
          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </Link>
  );
}
