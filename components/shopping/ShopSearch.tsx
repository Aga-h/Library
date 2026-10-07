"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SearchInput from "@/components/ui/SearchInput";

/** Searches the shops — name, address, category and notes — keeping the category filter. */
export default function ShopSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onSearch(q: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return <SearchInput defaultValue={defaultValue} onSearch={onSearch} placeholder="Search shops and notes" />;
}
