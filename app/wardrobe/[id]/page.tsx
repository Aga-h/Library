export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { calculateWash } from "@/lib/wash-calculator";
import WashRecommendationCard from "@/components/wardrobe/WashRecommendation";
import DeleteGarmentButton from "@/components/wardrobe/DeleteGarmentButton";
import WardrobeActions from "@/components/wardrobe/WardrobeActions";

const TYPE_LABELS: Record<string, string> = {
  TOPS: "Top", BOTTOMS: "Bottoms", OUTERWEAR: "Outerwear",
  UNDERWEAR: "Underwear", SOCKS: "Socks", ACTIVEWEAR: "Activewear",
  FORMALWEAR: "Formalwear", ACCESSORIES: "Accessories", OTHER: "Other",
};

const URGENCY_STYLES: Record<string, string> = {
  fresh: "bg-green-50 text-green-700 border-green-200",
  can_wait: "bg-gray-50 text-gray-600 border-gray-200",
  wash_soon: "bg-amber-50 text-amber-700 border-amber-200",
  wash_now: "bg-red-50 text-red-700 border-red-200",
};

type RouteContext = { params: Promise<{ id: string }> };

export default async function GarmentDetailPage({ params }: RouteContext) {
  const { id } = await params;
  const garment = await db.garment.findUnique({ where: { id } });
  if (!garment) notFound();

  const rec = calculateWash({
    materials: garment.materials,
    washMethod: garment.washMethod,
    maxTemp: garment.maxTemp,
    washCycle: garment.washCycle,
    spinLevel: garment.spinLevel,
    dryMethod: garment.dryMethod,
    colorGroup: garment.colorGroup,
    type: garment.type,
    wornCount: garment.wornCount,
  });

  const lastWashedStr = garment.lastWashed
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(garment.lastWashed)
    : "Never";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/wardrobe" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Wardrobe
      </Link>

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {garment.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={garment.image} alt={garment.name} className="w-full h-48 object-cover" />
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{garment.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {TYPE_LABELS[garment.type] ?? garment.type}
                {garment.brand ? ` · ${garment.brand}` : ""}
                {garment.color ? ` · ${garment.color}` : ""}
              </p>
            </div>
            <span className={`flex-shrink-0 border text-xs font-semibold px-2.5 py-1 rounded-full ${URGENCY_STYLES[rec.urgency]}`}>
              {rec.urgencyLabel}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
            <span><span className="font-semibold text-gray-900">{garment.wornCount}</span> wear{garment.wornCount !== 1 ? "s" : ""} since last wash</span>
            <span>Last washed: <span className="font-semibold text-gray-900">{lastWashedStr}</span></span>
          </div>

          {/* Materials */}
          <p className="mt-3 text-sm text-gray-600">
            <span className="font-medium text-gray-700">Materials: </span>{garment.materials}
          </p>
          {garment.notes && (
            <p className="mt-1 text-sm text-gray-500 italic">{garment.notes}</p>
          )}

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <WardrobeActions garmentId={garment.id} wornCount={garment.wornCount} />
            <Link
              href={`/wardrobe/${garment.id}/edit`}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Link>
            <DeleteGarmentButton garmentId={garment.id} />
          </div>
        </div>
      </div>

      {/* Wash recommendation */}
      <WashRecommendationCard rec={rec} />
    </div>
  );
}
