"use client";

import { useEffect, useRef } from "react";

/**
 * On a phone, scrolls the element this ref is attached to into view whenever `key` changes —
 * never on the first render. A flashcard's answer or a question's verdict can push the next
 * button below the screen; this brings it up to the thumb. A no-op when it is already in view,
 * and on anything wider than a phone.
 */
export function useBringIntoReach<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  const last = useRef(key);

  useEffect(() => {
    if (Object.is(last.current, key)) return;
    last.current = key;
    if (!ref.current || !window.matchMedia("(max-width: 639.98px)").matches) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  }, [key]);

  return ref;
}
