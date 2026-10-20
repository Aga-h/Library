"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";

/** One edition on the flow: its own cover, page count and Google Books volume. */
export interface FlowEdition {
  googleBooksId: string;
  /** null until fetched: a search can leave a print edition's count out. */
  pages: number | null;
  /**
   * Once volumes.get was asked: "checked" — `pages` is its count, the one Google's own page shows
   * and an import stores (a search can say 542 where both say 541) — or why `pages` is still null.
   */
  pagesState?: "checked" | "none" | "failed";
  year: number | null;
  publisher: string | null;
  cover: string | null;
  coverThumb: string | null;
  /** 300px, sharp on a retina screen; falls back to `cover` where Google has no larger one. */
  coverLarge: string | null;
  ebook: boolean;
  isbn: string | null;
}

// docs/design/how-cover-flow-works.md §4, in card widths. One number, the position p, places
// every card: d = i − p, and only a card within one place of the centre turns.
const THETA = 62; // side cards' angle, degrees
const GAP = 0.82; // centre card to the first card of each stack
const SPACING = 0.26; // between stacked cards
const DEPTH = 0.5; // how far back the stacks sit
const PER_ITEM = 0.5; // drag that moves the row one card
const COAST = 0.25; // seconds a flick coasts before it snaps (§6)
const VISIBLE = 8; // cards shown each side of the centre
const REFLECTION = "below 3px linear-gradient(transparent 66%, rgb(255 255 255 / 0.32))";

/**
 * Google answers a cover it doesn't have with "image not available": 128×170 at zoom=1, resized or
 * not; 575×750 at zoom=2, and 300×391 there for one it has only small (covers once used zoom=2).
 */
const PLACEHOLDERS = ["575x750", "128x170", "300x391"];
const isPlaceholder = (img: HTMLImageElement) => PLACEHOLDERS.includes(`${img.naturalWidth}x${img.naturalHeight}`);

type Drag = { pointer: number; x0: number; p0: number; moved: boolean; samples: { x: number; t: number }[] };

function format(edition: FlowEdition): string {
  return edition.ebook ? "eBook" : "Print";
}

function pagesOf(edition: FlowEdition): string {
  if (edition.pages) return `${edition.pages} pages`;
  if (edition.pagesState === "none") return "no page count on Google Books";
  if (edition.pagesState === "failed") return "page count unavailable right now";
  return "finding the page count…";
}

/** The card width that suits the stage: three covers fit across a phone, more on a wide screen. */
function cardWidth(stage: number): number {
  return Math.round(Math.max(92, Math.min(156, stage * 0.26)));
}

/**
 * Cover Flow for a book's editions. The centred card is the edition that will be imported. Drag
 * or flick the row, tap a side card, scroll sideways, or — with the row focused — use the arrow
 * keys and Home/End; the buttons under it step one edition.
 */
export default function EditionCoverFlow({
  editions,
  index,
  onIndex,
  complete = true,
  onNoCover,
}: {
  editions: FlowEdition[];
  index: number;
  onIndex: (index: number) => void;
  /** false while more editions may still arrive — then one edition is not "the only" one. */
  complete?: boolean;
  /** An edition whose cover turned out to be Google's "image not available" at every size. */
  onNoCover?: (googleBooksId: string) => void;
}) {
  const id = useId();
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<Array<HTMLDivElement | null>>([]);
  const pos = useRef(index); // where the row is
  const target = useRef(index); // where it is heading
  const drag = useRef<Drag | null>(null);
  const run = useRef<() => void>(() => {});
  const onIndexRef = useRef(onIndex);
  const [width, setWidth] = useState(120);
  const [centre, setCentre] = useState(index);
  const last = editions.length - 1;

  useEffect(() => {
    onIndexRef.current = onIndex;
  }, [onIndex]);

  const settle = useCallback((at: number) => {
    const next = Math.max(0, Math.min(last, Math.round(at)));
    target.current = next;
    onIndexRef.current(next);
    run.current();
  }, [last]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(cardWidth(el.clientWidth)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // When more editions arrive the list can reorder, and an edition with no real cover drops out.
  // The edition at the centre stays there: the row shifts by however far it moved, with no
  // animation, and the new place is reported. If the centre itself dropped out, its neighbour
  // takes its place.
  const shownIds = useRef(editions.map((e) => e.googleBooksId));
  useEffect(() => {
    const before = shownIds.current;
    shownIds.current = editions.map((e) => e.googleBooksId);
    const was = Math.round(target.current);
    const held = before[was];
    const found = held ? shownIds.current.indexOf(held) : -1;
    const now = found === -1 ? Math.max(0, Math.min(was, shownIds.current.length - 1)) : found;
    if (now === was && found !== -1) return;
    pos.current += now - was;
    target.current = now;
    onIndexRef.current(now);
  }, [editions]);

  // The motion. Frames run only while the row is moving or held, never at rest.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let before = 0;

    const place = () => {
      const p = pos.current;
      cards.current.forEach((el, i) => {
        if (!el || i > last) return;
        const d = i - p;
        const t = Math.max(-1, Math.min(1, d));
        const x = (t * GAP + (d - t) * SPACING) * width;
        const z = -Math.abs(t) * DEPTH * width;
        el.style.transform = `translateX(${x.toFixed(1)}px) translateZ(${z.toFixed(1)}px) rotateY(${(-t * THETA).toFixed(2)}deg)`;
        el.style.zIndex = String(1000 - Math.round(Math.abs(d) * 10));
        el.style.visibility = Math.abs(d) > VISIBLE ? "hidden" : "visible";
        el.style.filter = `brightness(${(1 - 0.35 * Math.abs(t)).toFixed(3)})`;
      });
    };

    const tick = (now: number) => {
      const dt = before ? Math.min(0.05, (now - before) / 1000) : 1 / 60;
      before = now;
      if (!drag.current) {
        const to = target.current;
        pos.current = reduce ? to : pos.current + (to - pos.current) * (1 - Math.exp(-12 * dt));
        if (Math.abs(to - pos.current) < 0.001) pos.current = to;
      }
      place();
      setCentre(Math.max(0, Math.min(last, Math.round(pos.current))));
      frame = drag.current || pos.current !== target.current ? requestAnimationFrame(tick) : 0;
      if (!frame) before = 0;
    };

    run.current = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    place();
    run.current();
    return () => cancelAnimationFrame(frame);
  }, [width, last]);

  // A pick made outside the flow (a new list of editions keeps its place) moves the row too.
  useEffect(() => {
    if (Math.round(target.current) === index) return;
    target.current = index;
    run.current();
  }, [index]);

  // A sideways scroll (trackpad, shift + wheel) moves the row; it lands once the scrolling stops.
  // Not passive, so the browser doesn't also take it as a back/forward swipe.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (ev: WheelEvent) => {
      const delta = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.shiftKey ? ev.deltaY : 0;
      if (!delta || last < 1) return;
      ev.preventDefault();
      const px = delta * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? el.clientWidth : 1);
      target.current = Math.max(-0.3, Math.min(last + 0.3, target.current + px / (PER_ITEM * width * 2)));
      run.current();
      clearTimeout(idle);
      idle = setTimeout(() => settle(target.current), 140);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(idle);
    };
  }, [width, last, settle]);

  // A press becomes a drag once it has moved a few pixels; until then it is a tap on a card.
  const onPointerDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0) return;
    drag.current = { pointer: ev.pointerId, x0: ev.clientX, p0: pos.current, moved: false, samples: [{ x: ev.clientX, t: ev.timeStamp }] };
  };
  const onPointerMove = (ev: PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (!held || held.pointer !== ev.pointerId) return;
    const dx = ev.clientX - held.x0;
    if (!held.moved) {
      if (Math.abs(dx) < 6) return;
      held.moved = true;
      ev.currentTarget.setPointerCapture(ev.pointerId);
    }
    held.samples.push({ x: ev.clientX, t: ev.timeStamp });
    let p = held.p0 - dx / (PER_ITEM * width);
    // Past either end the row gives a little, then springs back on release.
    if (p < 0) p /= 3;
    else if (p > last) p = last + (p - last) / 3;
    pos.current = p;
    run.current();
  };
  const onPointerUp = (ev: PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (!held || held.pointer !== ev.pointerId) return;
    drag.current = null;
    if (!held.moved) {
      const card = (ev.target as Element).closest<HTMLElement>("[data-edition]");
      if (card) settle(Number(card.dataset.edition));
      return;
    }
    // A flick coasts on: its speed over the last 100ms, in cards a second (§6).
    const recent = held.samples.filter((s) => ev.timeStamp - s.t <= 100);
    const first = recent[0];
    const seconds = first ? (ev.timeStamp - first.t) / 1000 : 0;
    const speed = seconds > 0 ? -(ev.clientX - first.x) / (PER_ITEM * width) / seconds : 0;
    settle(pos.current + speed * COAST);
  };
  const onPointerCancel = () => {
    if (!drag.current) return;
    drag.current = null;
    settle(pos.current);
  };

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowLeft: Math.round(target.current) - 1,
      ArrowRight: Math.round(target.current) + 1,
      Home: 0,
      End: last,
    };
    if (!(ev.key in step)) return;
    ev.preventDefault();
    settle(step[ev.key]);
  };

  const height = Math.round(width * 1.5);
  const shown = editions[Math.min(centre, last)];
  const caption = shown
    ? [format(shown), shown.publisher, shown.year, pagesOf(shown)].filter(Boolean).join(" · ")
    : "";
  const stepCls = "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors";

  return (
    <div>
      <div
        ref={stage}
        role="listbox"
        aria-label="Editions"
        aria-activedescendant={shown ? `${id}-${Math.min(centre, last)}` : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className={`relative overflow-hidden touch-pan-y select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ${last > 0 ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ height: Math.round(height * 1.34) + 12, perspective: `${Math.round(width * 3.6)}px` }}
      >
        {editions.map((edition, i) => {
          const src = edition.coverLarge ?? edition.cover ?? edition.coverThumb;
          const fallback = edition.cover ?? edition.coverThumb;
          return (
            <div
              key={edition.googleBooksId}
              id={`${id}-${i}`}
              ref={(el) => {
                cards.current[i] = el;
              }}
              role="option"
              aria-selected={i === centre}
              aria-label={`${format(edition)}, ${pagesOf(edition)}${edition.year ? `, ${edition.year}` : ""}${edition.publisher ? `, ${edition.publisher}` : ""}`}
              data-edition={i}
              className="absolute left-1/2 top-3 rounded-[3px] bg-gray-100 shadow-lg overflow-hidden will-change-transform"
              style={{ width, height, marginLeft: -width / 2, visibility: "hidden", WebkitBoxReflect: REFLECTION } as CSSProperties}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" draggable={false} decoding="async" className="w-full h-full object-cover pointer-events-none"
                  onError={(ev) => {
                    if (fallback && ev.currentTarget.src !== fallback) ev.currentTarget.src = fallback;
                  }}
                  onLoad={(ev) => {
                    const img = ev.currentTarget;
                    if (!isPlaceholder(img)) return;
                    // No large cover: try the stored size before giving the edition up.
                    if (fallback && img.src !== fallback) img.src = fallback;
                    else onNoCover?.(edition.googleBooksId);
                  }} />
              ) : (
                <div className="w-full h-full flex flex-col justify-between p-2.5 bg-gradient-to-br from-gray-50 to-gray-200">
                  <BookOpen className="w-5 h-5 text-gray-400" />
                  <span className="text-[11px] leading-tight text-gray-500">
                    <span className="block text-base font-semibold text-gray-800">{edition.pages ?? "—"}</span>
                    pages · {format(edition)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-1">
        {last > 0 && (
          <button type="button" onClick={() => settle(Math.round(target.current) - 1)} disabled={centre === 0}
            aria-label="Previous edition" className={stepCls}>
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <div className="min-w-0 text-center px-1" aria-live="polite">
          <p className="text-sm font-medium text-gray-700">{caption}</p>
          <p className="text-[11px] text-gray-500">
            {last > 0 ? `Edition ${Math.min(centre, last) + 1} of ${editions.length}` : complete ? "The only edition Google Books lists" : "\u00a0"}
            {shown?.isbn ? ` · ISBN ${shown.isbn}` : ""}
          </p>
        </div>
        {last > 0 && (
          <button type="button" onClick={() => settle(Math.round(target.current) + 1)} disabled={centre === last}
            aria-label="Next edition" className={stepCls}>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
