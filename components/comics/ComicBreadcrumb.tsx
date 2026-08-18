import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  /** Omit on the last crumb so it renders as plain current-page text. */
  href?: string;
}

export default function ComicBreadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6 flex-wrap">
      <Link href="/library/comics" className="hover:text-gray-800 transition-colors">
        Comics
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.label} className="flex items-center gap-1.5">
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          {crumb.href ? (
            <Link href={crumb.href} className="hover:text-gray-800 transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
