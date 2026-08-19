import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  /** Omit on the last crumb so it renders as plain current-page text. */
  href?: string;
}

interface Props {
  rootHref: string;
  rootLabel: string;
  crumbs: Crumb[];
}

export default function Breadcrumb({ rootHref, rootLabel, crumbs }: Props) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6 flex-wrap">
      <Link href={rootHref} className="hover:text-gray-800 transition-colors">
        {rootLabel}
      </Link>
      {crumbs.map((crumb, i) => (
        // Index, not label — two levels can legitimately share a name.
        <span key={`${i}-${crumb.label}`} className="flex items-center gap-1.5">
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
