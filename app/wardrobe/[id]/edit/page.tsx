export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import GarmentForm from "@/components/wardrobe/GarmentForm";

type RouteContext = { params: Promise<{ id: string }> };

export default async function EditGarmentPage({ params }: RouteContext) {
  const { id } = await params;
  const garment = await db.garment.findUnique({ where: { id } });
  if (!garment) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/wardrobe/${garment.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Edit Garment</h2>
        <GarmentForm
          mode="edit"
          initialData={{
            id: garment.id,
            name: garment.name,
            type: garment.type,
            brand: garment.brand ?? "",
            color: garment.color ?? "",
            colorGroup: garment.colorGroup,
            materials: garment.materials,
            washMethod: garment.washMethod,
            maxTemp: garment.maxTemp,
            washCycle: garment.washCycle,
            spinLevel: garment.spinLevel,
            dryMethod: garment.dryMethod,
            image: garment.image ?? "",
            notes: garment.notes ?? "",
          }}
        />
      </div>
    </div>
  );
}
