"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  /** Names the sheet for assistive tech, e.g. "Confirm delete". */
  label: string;
  /** Tapping the dimmed page around the sheet — the same as its Cancel. */
  onDismiss: () => void;
  children: ReactNode;
}

/**
 * Phones only (under sm): a step that opens in place — a confirm, a picker — shown as a sheet along
 * the bottom edge instead, over a scrim that dismisses it. Such steps sit in a page header's button
 * row, and on a phone that row is a few dozen pixels wide wherever it is laid out; the sheet is the
 * screen's width whatever its parent does. Rendered into <body>, because a frosted panel around the
 * row (backdrop-filter, as in the softclub look) would otherwise pin a fixed element inside itself.
 *
 * Only ever mount it after a tap, never on the server render. Callers keep their inline version
 * for sm up and hide it on phones (`max-sm:hidden`).
 */
export default function PhoneSheet({ label, onDismiss, children }: Props) {
  return createPortal(
    <div className="sm:hidden fixed inset-0 z-[70]">
      <div aria-hidden onClick={onDismiss} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-label={label}
        className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto overscroll-contain flex flex-col gap-3 bg-white border-t border-gray-200 shadow-xl pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
