import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import GarmentForm from "@/components/wardrobe/GarmentForm";

export default function NewGarmentPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/self-care/wardrobe" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 max-sm:-mt-2.5 max-sm:mb-3.5 max-sm:py-2.5 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Wardrobe
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Add Garment</h2>
        <GarmentForm mode="create" />
      </div>
    </div>
  );
}
