"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  applyNavigation,
  currentHref,
  decideBack,
  EMPTY_TRAIL,
  parseTrail,
  restoreTrail,
  sameDestination,
  shouldShowFloatingBack,
  type Trail,
} from "@/lib/back-nav";

const STORAGE_KEY = "portal-back-trail";

/**
 * One back control for the whole site, fixed to the viewport. The arrows at the top of a page
 * stay as they are; this one is for when those have scrolled away. It reads the trail in
 * `lib/back-nav.ts` and either steps back through this tab (`router.back`) or opens the
 * parent that page's own arrow links to. Rendered under a Suspense boundary because it
 * follows the query string.
 */
export default function FloatingBackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const href = currentHref(pathname, search);

  const [trail, setTrail] = useState<Trail>(EMPTY_TRAIL);
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);

  const lengthRef = useRef(0);
  const popRef = useRef(false);
  const fallbackHref = useRef<string | null>(null);
  const locked = useRef(false);
  const booted = useRef(false);

  useEffect(() => {
    const onPop = () => {
      popRef.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!booted.current) {
      booted.current = true;
      const next = restoreTrail(readTrail(), href, document.referrer, location.origin);
      lengthRef.current = history.length;
      writeTrail(next);
      setTrail(next);
      setReady(true);
      return;
    }

    const popped = popRef.current;
    const expected = fallbackHref.current;
    popRef.current = false;
    fallbackHref.current = null;
    const grew = history.length > lengthRef.current;
    lengthRef.current = history.length;

    setTrail((prev) => {
      const next = expected && sameDestination(expected, href)
        ? applyNavigation(prev, href, "fallback")
        : applyNavigation(prev, href, popped ? "pop" : grew ? "push" : "replace");
      writeTrail(next);
      return next;
    });
  }, [href]);

  useEffect(() => {
    if (!ready) return;
    const measure = () => {
      const { scrolled, overflow } = pageScroll();
      const decision = decideBack(trail, href);
      const next = shouldShowFloatingBack(scrolled, overflow, decision.type !== "none", overlayOpen());
      setShow((prev) => (prev === next ? prev : next));
    };

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    measure();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["inert", "aria-modal", "aria-expanded", "hidden"],
    });
    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [href, ready, trail]);

  const goBack = () => {
    if (locked.current) return;
    const decision = decideBack(trail, href);
    if (decision.type === "none") return;
    if (decision.type === "href" && (!decision.href.startsWith("/") || decision.href.startsWith("//"))) return;
    locked.current = true;
    window.setTimeout(() => {
      locked.current = false;
    }, 500);
    if (decision.type === "history") {
      router.back();
      return;
    }
    fallbackHref.current = decision.href;
    router.push(decision.href);
  };

  if (!show) return null;

  return (
    <button
      type="button"
      data-floating-back
      onClick={goBack}
      aria-label="Go back"
      className="floating-back fixed z-[45] flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition-colors hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 motion-reduce:transition-none"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      <span className="floating-back-tip" aria-hidden>Go back</span>
    </button>
  );
}

function pageScroll(): { scrolled: number; overflow: number } {
  const doc = document.scrollingElement;
  let scrolled = window.scrollY || 0;
  let overflow = 0;
  if (doc) {
    scrolled = Math.max(scrolled, doc.scrollTop);
    overflow = Math.max(overflow, doc.scrollHeight - doc.clientHeight);
  }
  const main = document.querySelector("main");
  if (main) {
    scrolled = Math.max(scrolled, main.scrollTop);
    overflow = Math.max(overflow, main.scrollHeight - main.clientHeight);
  }
  return { scrolled, overflow };
}

/** The phone drawer and a bottom sheet cover the corner. Both mark themselves as modal;
 *  the drawer stays in the page while closed, inert and invisible. */
function overlayOpen(): boolean {
  for (const node of document.querySelectorAll<HTMLElement>("[aria-modal='true']")) {
    if (node.closest("[inert], .invisible")) continue;
    const box = node.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) continue;
    return true;
  }
  return false;
}

function readTrail(): Trail | null {
  try {
    return parseTrail(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeTrail(trail: Trail) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trail));
  } catch {
    // Private mode and a full quota both leave the button on the parent fallback.
  }
}
