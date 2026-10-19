"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  /** Names the sheet for assistive tech, e.g. "Confirm delete". */
  label: string;
  /** Tapping the dimmed page around the sheet — the same as its Cancel. */
  onDismiss: () => void;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Phones only (under sm): a step that opens in place — a confirm, a picker — shown as a sheet along
 * the bottom edge instead, over a scrim that dismisses it. Such steps sit in a page header's button
 * row, and on a phone that row is a few dozen pixels wide wherever it is laid out; the sheet is the
 * screen's width whatever its parent does. Rendered into <body>, because a frosted panel around the
 * row (backdrop-filter, as in the softclub look) would otherwise pin a fixed element inside itself.
 *
 * Only ever mount it after a tap, never on the server render. Callers keep their inline version
 * for sm up and hide it on phones (`max-sm:hidden`).
 *
 * While open: focus starts on the first control, Tab stays in the sheet, Escape dismisses it, and
 * the page behind it does not scroll — the same contract as the Library/Study menu drawer.
 */
export default function PhoneSheet({ label, onDismiss, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  // Callers mount the sheet at every width and it hides itself from sm up, where their inline
  // version is showing. So the sheet only takes over the page — scroll, focus, Escape — while
  // the screen is under sm; otherwise a desktop page would stop scrolling during a confirm.
  useEffect(() => {
    const phone = window.matchMedia("(width < 40rem)");
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    const lock = () => {
      root.style.overflow = phone.matches ? "hidden" : overflow;
    };
    lock();
    phone.addEventListener("change", lock);

    const moveFocus = phone.matches;
    if (moveFocus) panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    return () => {
      phone.removeEventListener("change", lock);
      root.style.overflow = overflow;
      if (moveFocus) previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && window.matchMedia("(width < 40rem)").matches) {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const keepFocusIn = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panel.current) return;
    const focusable = panel.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="sm:hidden fixed inset-0 z-[70]">
      <div aria-hidden onClick={onDismiss} className="absolute inset-0 bg-black/40" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onKeyDown={keepFocusIn}
        className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto overscroll-contain flex flex-col gap-3 bg-white border-t border-gray-200 shadow-xl pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
