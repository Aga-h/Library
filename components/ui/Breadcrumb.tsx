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

// On phones the links are the way back up, so each gets a taller hit area; the negative margin
// keeps it from spreading the rows apart.
const linkCls = "py-1.5 -my-1.5 sm:py-0 sm:my-0 hover:text-gray-800 transition-colors";

export default function Breadcrumb({ rootHref, rootLabel, crumbs }: Props) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6 flex-wrap min-w-0">
      <Link href={rootHref} className={linkCls}>
        {rootLabel}
      </Link>
      {crumbs.map((crumb, i) => (
        // Index, not label — two levels can legitimately share a name.
        // min-w-0 + break-words: a long title wraps onto its own lines instead of off the screen.
        // On phones the chevron stays on its first line (3px centres it on a single 20px line);
        // from sm up it sits centred beside the crumb, as it always has.
        <span key={`${i}-${crumb.label}`} className="flex items-center max-sm:items-start gap-1.5 min-w-0">
          <ChevronRight className="w-3.5 h-3.5 max-sm:mt-[3px] text-gray-300 flex-shrink-0" />
          {crumb.href ? (
            <Link href={crumb.href} className={`${linkCls} min-w-0 break-words`}>
              {crumb.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium min-w-0 break-words">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
