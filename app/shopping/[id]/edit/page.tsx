export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { categoryOptions } from "@/lib/shopping";
import { categoriesInUse } from "@/lib/shopping-service";
import ShopForm from "@/components/shopping/ShopForm";
import DeleteEntityButton from "@/components/ui/DeleteEntityButton";

export default async function EditShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shop = await db.shop.findUnique({ where: { id } });
  if (!shop) notFound();
  const categories = categoryOptions(await categoriesInUse());

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/shopping" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Shopping
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900">Edit {shop.name}</h2>
          <DeleteEntityButton apiPath={`/api/shopping/${shop.id}`} redirectTo="/shopping" />
        </div>
        <ShopForm mode="edit" categories={categories} initialData={{
          id: shop.id, url: shop.url, name: shop.name, category: shop.category,
          liked: shop.liked ?? "", disliked: shop.disliked ?? "",
        }} />
      </div>
    </div>
  );
}
