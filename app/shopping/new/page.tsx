export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { categoryOptions } from "@/lib/shopping";
import { categoriesInUse } from "@/lib/shopping-service";
import ShopForm from "@/components/shopping/ShopForm";

export default async function NewShopPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const categories = categoryOptions(await categoriesInUse());
  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/shopping" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 max-sm:-mt-2.5 max-sm:mb-3.5 max-sm:py-2.5 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Shopping
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Add a shop</h2>
        <ShopForm mode="create" categories={categories} initialData={category ? { category } : undefined} />
      </div>
    </div>
  );
}
