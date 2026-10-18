"use client";

import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Menu, X, type LucideIcon } from "lucide-react";
import LogoutButton from "@/components/layout/LogoutButton";
import ThemePicker from "@/components/ui/ThemePicker";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };

const isActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.href : pathname.startsWith(item.href);

/**
 * A section's navigation — Library's, Study's. From lg up it is the sidebar down the left. Below lg
 * (phones, phones turned sideways, iPads in portrait) a sidebar would eat the page, so it gives way
 * to a top bar naming the section and the open page, whose menu button draws the same sidebar in
 * from the left as a drawer over the page.
 *
 * Desktop sidebar and drawer carry the hook classes the looks style a sidebar by (theme-sidebar,
 * theme-brand, theme-nav, theme-nav-item[data-active]); the top bar is a theme-header, like the
 * other sections' headers. theme-topbar and theme-drawer mark the phone versions for the looks.
 */
export default function SectionNav({ brand, icon: Icon, groups, signOut = false }: {
  brand: string;
  icon: LucideIcon;
  groups: NavGroup[];
  /** Offer "Sign out" under "Back to Portal". */
  signOut?: boolean;
}) {
  const pathname = usePathname();
  const page = groups.flatMap((g) => g.items).find((item) => isActive(pathname, item))?.label;

  const [open, setOpen] = useState(false);
  // Changing page closes the drawer. Reset while rendering, as React advises for state that
  // follows a prop — the link tap itself closes it too (below), for a tap on the open page.
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setOpen(false);
  }

  const drawerId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // While open: focus is in the drawer, the page beneath doesn't scroll, Escape closes it.
  // Closing hands focus back to the menu button.
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) menuButton.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    closeButton.current?.focus();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    // On window, so an open look menu inside gets the Escape first (it marks it handled).
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) setOpen(false);
    };
    // The drawer only exists below lg: a window widened past it (an iPad turned landscape) closes it.
    const wide = window.matchMedia("(min-width: 64rem)");
    const onWide = () => {
      if (wide.matches) setOpen(false);
    };
    // A page wider than the screen can still be panned with html's overflow hidden. A drag on the
    // dimmed page does nothing (touch-none); a drag on a drawer with nothing to scroll does nothing
    // either. One that can scroll keeps the drag to itself (overscroll-contain).
    const drawer = panel.current;
    const onDrag = (e: TouchEvent) => {
      if (e.cancelable && drawer && drawer.scrollHeight <= drawer.clientHeight) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    drawer?.addEventListener("touchmove", onDrag, { passive: false });
    return () => {
      root.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      drawer?.removeEventListener("touchmove", onDrag);
    };
  }, [open]);

  // Tab and Shift+Tab go round the drawer rather than out into the page behind it.
  const keepFocusIn = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panel.current) return;
    const focusable = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  const closeOnLink = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest("a[href]")) setOpen(false);
  };

  const brandMark = (
    <>
      <Icon className="w-6 h-6 text-gray-900" />
      <span className="font-bold text-gray-900 text-lg">{brand}</span>
    </>
  );
  // In the drawer the menu keeps its full height and the drawer scrolls on a short screen, even
  // where a look clips the menu (acid, for its globe); its items are a finger's height.
  const nav = (inDrawer: boolean) => (
    <nav className={`theme-nav ${inDrawer ? "flex-[1_0_auto]" : "flex-1"} px-3 py-4 space-y-0.5`}>
      {groups.map((group, i) => (
        <Fragment key={group.label ?? i}>
          {group.label && (
            <p className="text-[11px] font-bold text-gray-300 uppercase tracking-wide px-3 pt-4 pb-1">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const active = isActive(pathname, item);
            const ItemIcon = item.icon;
            return (
              <Link key={item.href} href={item.href} data-active={active || undefined} aria-current={active ? "page" : undefined}
                className={`theme-nav-item flex items-center gap-3 px-3 ${inDrawer ? "py-2.5" : "py-2"} rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}>
                <ItemIcon className="w-4 h-4 flex-shrink-0" />
                <span className="theme-nav-label">{item.label}</span>
              </Link>
            );
          })}
        </Fragment>
      ))}
    </nav>
  );
  const foot = (
    <>
      <div className="pt-4 border-t border-gray-100">
        <ThemePicker variant="compact" />
      </div>
      <div className="px-3 py-4 flex flex-col gap-1">
        <Link href="/" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4 flex-shrink-0" />
          Back to Portal
        </Link>
        {signOut && <LogoutButton />}
      </div>
    </>
  );

  return (
    <>
      <aside className="theme-sidebar w-56 flex-shrink-0 hidden lg:flex flex-col bg-white border-r border-gray-200 min-h-screen">
        <div className="theme-brand flex items-center gap-2.5 px-5 py-5 border-b border-gray-200">{brandMark}</div>
        {nav(false)}
        {foot}
      </aside>

      {/* Phone: the top bar. Sticky on a wrapper, since the looks position the header itself. */}
      <div className="sticky top-0 z-[55] lg:hidden">
        <header className="theme-header theme-topbar flex items-center gap-2 bg-white border-b border-gray-200 pt-[calc(0.375rem+env(safe-area-inset-top))] pb-1.5 pl-[max(0.375rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <button ref={menuButton} type="button" aria-label="Menu" aria-expanded={open} aria-controls={drawerId}
            onClick={() => setOpen(true)}
            className="theme-menu-button flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <span className="theme-topbar-brand flex flex-shrink-0 items-center gap-2">
            <Icon className="w-5 h-5 text-gray-900" />
            <span className="font-bold text-gray-900">{brand}</span>
          </span>
          {page && (
            <>
              <span aria-hidden className="theme-topbar-sep text-gray-300">/</span>
              {/* Keyed, so a look can animate the name as it changes. */}
              <span key={page} className="theme-topbar-page min-w-0 truncate text-sm font-semibold text-gray-900">{page}</span>
            </>
          )}
        </header>
      </div>

      {/* Phone: the drawer. Always there, so it can slide out as well as in; hidden and inert
          while closed. A look can retime the slide with --theme-drawer-time. As tall as the
          screen (dvh) rather than the layout viewport, which a page too wide for the screen
          stretches past it; and a drag on the dimmed page does nothing, so it can't pan. */}
      <div inert={!open}
        className={`fixed inset-x-0 top-0 h-dvh z-[60] lg:hidden ${
          open ? "visible" : "invisible [transition:visibility_0s_linear_var(--theme-drawer-time,300ms)] motion-reduce:[transition:none]"
        }`}>
        <div aria-hidden onClick={() => setOpen(false)}
          className={`theme-drawer-overlay absolute inset-0 touch-none bg-black/40 transition-opacity duration-[var(--theme-drawer-time,300ms)] motion-reduce:transition-none ${
            open ? "opacity-100" : "opacity-0"
          }`} />
        <div ref={panel} id={drawerId} role="dialog" aria-modal="true" aria-label={`${brand} menu`}
          onKeyDown={keepFocusIn} onClick={closeOnLink}
          className={`theme-sidebar theme-drawer absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col bg-white border-r border-gray-200 shadow-xl overflow-y-auto overscroll-contain touch-pan-y pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] transition-transform duration-[var(--theme-drawer-time,300ms)] ease-out motion-reduce:transition-none ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}>
          <div className="theme-brand flex items-center gap-2.5 px-5 py-5 border-b border-gray-200">
            {brandMark}
            <button ref={closeButton} type="button" aria-label="Close menu" onClick={() => setOpen(false)}
              className="theme-drawer-close ml-auto -my-2 -mr-3 w-11 h-11 flex flex-shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          {nav(true)}
          {foot}
        </div>
      </div>
    </>
  );
}
