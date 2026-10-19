"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Cover Flow for a book's editions. One scroll position drives every card — see
 * docs/design/how-cover-flow-works.md. The center card is the edition that will be imported.
 */
export interface FlowEdition {
  googleBooksId: string;
  pages: number;
  year: number | null;
  publisher: string | null;
  cover: string | null;
  coverThumb: string | null;
  ebook: boolean;
}

const THETA = 62;
const GAP = 0.82;
const SPACING = 0.26;
const DEPTH = 0.5;

export default function EditionCoverFlow({
  editions,
  index,
  onIndex,
}: {
  editions: FlowEdition[];
  index: number;
  onIndex: (index: number) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const pRef = useRef(index);
  const targetRef = useRef(index);
  const dragRef = useRef<{ x0: number; p0: number; x: number; t: number; v: number; px: number } | null>(null);
  const onIndexRef = useRef(onIndex);
  onIndexRef.current = onIndex;

  useEffect(() => {
    targetRef.current = index;
  }, [index]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = performance.now();

    const clamp = (n: number) => Math.max(0, Math.min(editions.length - 1, n));

    const layout = () => {
      const narrow = stage.clientWidth < 480;
      const W = narrow ? 104 : 148;
      const p = pRef.current;
      cardsRef.current.forEach((el, i) => {
        if (!el) return;
        const d = i - p;
        const t = Math.max(-1, Math.min(1, d));
        const x = t * GAP * W + (d - t) * SPACING * W;
        const z = -Math.abs(t) * DEPTH * W;
        const r = -t * THETA;
        el.style.width = `${W}px`;
        el.style.height = `${Math.round(W * 1.5)}px`;
        el.style.marginLeft = `${-W / 2}px`;
        el.style.transform = `translateX(${x}px) translateZ(${z}px) rotateY(${r}deg)`;
        el.style.zIndex = String(1000 - Math.round(Math.abs(d) * 10));
        el.style.visibility = Math.abs(d) > 8 ? "hidden" : "visible";
        el.style.filter = `brightness(${(1 - 0.4 * Math.abs(t)).toFixed(3)})`;
        el.setAttribute("aria-selected", String(Math.round(p) === i));
      });
    };

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!dragRef.current) {
        const target = targetRef.current;
        if (reduce) pRef.current = target;
        else pRef.current += (target - pRef.current) * (1 - Math.exp(-12 * dt));
        if (Math.abs(target - pRef.current) < 0.0005) pRef.current = target;
      }
      layout();
      frame = requestAnimationFrame(tick);
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
      if (document.activeElement !== stage && !stage.contains(document.activeElement)) return;
      ev.preventDefault();
      const next = clamp(Math.round(targetRef.current) + (ev.key === "ArrowRight" ? 1 : -1));
      targetRef.current = next;
      onIndexRef.current(next);
    };

    frame = requestAnimationFrame(tick);
    stage.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      stage.removeEventListener("keydown", onKey);
    };
  }, [editions]);

  function settle(next: number) {
    const clamped = Math.max(0, Math.min(editions.length - 1, next));
    targetRef.current = clamped;
    onIndex(clamped);
  }

  const center = editions[index];
  const caption = center
    ? [center.ebook ? "Kindle" : "Print", center.publisher, center.year, `${center.pages} pages`].filter(Boolean).join(" · ")
    : "";

  return (
    <div>
      <div
        ref={stageRef}
        className="relative h-64 sm:h-72 overflow-hidden touch-pan-y select-none outline-none"
        style={{ perspective: "800px" }}
        tabIndex={0}
        role="listbox"
        aria-label="Editions"
        aria-activedescendant={center ? `edition-${center.googleBooksId}` : undefined}
        onPointerDown={(ev) => {
          ev.currentTarget.setPointerCapture(ev.pointerId);
          const W = ev.currentTarget.clientWidth < 480 ? 104 : 148;
          dragRef.current = { x0: ev.clientX, p0: pRef.current, x: ev.clientX, t: ev.timeStamp, v: 0, px: 0.5 * W };
        }}
        onPointerMove={(ev) => {
          const drag = dragRef.current;
          if (!drag) return;
          const dt = Math.max(1, ev.timeStamp - drag.t) / 1000;
          drag.v = -(ev.clientX - drag.x) / drag.px / dt;
          drag.x = ev.clientX;
          drag.t = ev.timeStamp;
          pRef.current = drag.p0 - (ev.clientX - drag.x0) / drag.px;
        }}
        onPointerUp={(ev) => {
          const drag = dragRef.current;
          dragRef.current = null;
          if (!drag) return;
          if (Math.abs(ev.clientX - drag.x0) < 5) {
            const hit = document.elementFromPoint(ev.clientX, ev.clientY);
            const card = hit && (hit as Element).closest?.("[data-edition]");
            const i = card ? Number((card as HTMLElement).dataset.edition) : NaN;
            if (!Number.isNaN(i)) settle(i);
            return;
          }
          settle(Math.round(pRef.current + drag.v * 0.25));
        }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        {editions.map((edition, i) => (
          <button
            key={edition.googleBooksId}
            id={`edition-${edition.googleBooksId}`}
            type="button"
            role="option"
            data-edition={i}
            ref={(el) => { cardsRef.current[i] = el; }}
            className="absolute left-1/2 top-4 rounded-md bg-gray-100 overflow-hidden shadow-md"
            style={{
              WebkitBoxReflect: "below 2px linear-gradient(transparent 62%, rgba(255,255,255,0.28))",
            } as CSSProperties}
            aria-label={`${edition.ebook ? "Kindle" : "Print"}, ${edition.pages} pages`}
            onClick={() => settle(i)}
          >
            {(edition.coverThumb ?? edition.cover) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={edition.coverThumb ?? edition.cover ?? ""} alt="" className="w-full h-full object-cover" />
            ) : null}
          </button>
        ))}
      </div>
      <p className="text-center text-sm text-gray-700 font-medium -mt-2" aria-live="polite">{caption}</p>
    </div>
  );
}
