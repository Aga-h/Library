/**
 * SVG filters the looks apply from CSS with `filter: url(#…)`. They have to be in the page: Chrome
 * won't use a filter from another document, a data URI included. Zero-sized rather than
 * display:none, which stops some browsers applying them. Unused by any look that doesn't ask.
 */
export default function ThemeFilters() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        {/* Acid: type that melts, as if seen through heat. Still: an animated filter has to be
            recomputed every frame, which made the whole look slow. */}
        <filter id="ac-melt" x="-5%" y="-25%" width="110%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.045" numOctaves={2} seed={3} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={6} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Acid: a thermal-camera colour map, like the Trance poster — shadows violet, mid-tones
            lavender, then acid green, orange, and white in the highlights. */}
        <filter id="ac-thermal" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.02 0.22 0.63 0.55 1 1" />
            <feFuncG type="table" tableValues="0 0.04 0.55 1 0.48 0.96" />
            <feFuncB type="table" tableValues="0.06 0.5 1 0.23 0.18 0.9" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
