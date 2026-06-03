"use client";

import Link from "next/link";
import { Shirt, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { thumbUrl } from "@/lib/covers";

interface Garment {
  id: string; name: string; type: string; brand: string | null;
  color: string | null; colorGroup: string; wornCount: number;
  lastWashed: Date | null; image: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  TOPS: "Top", BOTTOMS: "Bottoms", OUTERWEAR: "Outerwear",
  UNDERWEAR: "Underwear", SOCKS: "Socks", ACTIVEWEAR: "Activewear",
  FORMALWEAR: "Formalwear", ACCESSORIES: "Accessories", OTHER: "Other",
};

function urgencyFromWornCount(type: string, count: number): { color: string; icon: React.ReactNode; label: string } {
  const base = type === "UNDERWEAR" || type === "SOCKS";
  if (count === 0) return { color: "bg-green-50 border-green-200", icon: <CheckCircle className="w-3.5 h-3.5 text-green-500" />, label: "Clean" };
  if (base || count >= 5) return { color: "bg-red-50 border-red-200", icon: <AlertCircle className="w-3.5 h-3.5 text-red-500" />, label: "Wash now" };
  if (count >= 3) return { color: "bg-amber-50 border-amber-200", icon: <Clock className="w-3.5 h-3.5 text-amber-500" />, label: "Wash soon" };
  return { color: "bg-gray-50 border-gray-200", icon: <Shirt className="w-3.5 h-3.5 text-gray-400" />, label: `${count} wear${count > 1 ? "s" : ""}` };
}

export default function GarmentCard({ garment }: { garment: Garment }) {
  const urgency = urgencyFromWornCount(garment.type, garment.wornCount);

  return (
    <Link href={`/wardrobe/${garment.id}`}
      className={`group flex flex-col bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all ${urgency.color}`}>
      <div className="bg-gray-100 h-40 flex items-center justify-center overflow-hidden">
        {garment.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl(garment.image, 300) ?? ""} alt={garment.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <Shirt className="w-12 h-12 text-gray-300" />
        )}
      </div>
      <div className="p-4 flex flex-col gap-1 flex-1">
        <h3 className="font-semibold text-gray-900 line-clamp-1 text-sm">{garment.name}</h3>
        <p className="text-xs text-gray-400">{TYPE_LABELS[garment.type] ?? garment.type}{garment.brand ? ` · ${garment.brand}` : ""}</p>
        <div className="flex items-center gap-1 mt-auto pt-2 text-xs font-medium text-gray-600">
          {urgency.icon}
          <span>{urgency.label}</span>
        </div>
      </div>
    </Link>
  );
}
