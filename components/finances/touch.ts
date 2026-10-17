/*
 * Tap targets on the finance pages. Desktop keeps its small controls; a phone gets 36–40px ones —
 * and so does a phone held sideways, which is past sm (667–932px wide) but still tapped with a
 * finger. The `[@media(hover:none)_and_(pointer:coarse)_and_(height<30rem)]` classes are that
 * sideways phone: the test app/globals.css uses for its 16px fields, which no tablet or desktop
 * window passes. They come after the sm: classes in the stylesheet, so they put the phone sizes
 * back. Tailwind only generates class names it finds written out whole, hence the repetition.
 */

/** An icon button in a row: a 14px icon with a 38px hit area on phones. The negative margin keeps
 * the row from growing by as much. */
export const ROW_ICON_BTN =
  "-my-1.5 flex-shrink-0 p-3 text-gray-400 transition-colors sm:my-0 sm:p-0 " +
  "[@media(hover:none)_and_(pointer:coarse)_and_(height<30rem)]:-my-1.5 [@media(hover:none)_and_(pointer:coarse)_and_(height<30rem)]:p-3";

/** The same, last in its row: on phones its padding reaches into the row's. */
export const ROW_END_ICON_BTN =
  `${ROW_ICON_BTN} -mr-2 sm:mr-0 [@media(hover:none)_and_(pointer:coarse)_and_(height<30rem)]:-mr-2`;

/** A primary button kept 40px tall on phones, whatever font size the look gives it (acid's
 * solid buttons set a smaller one). */
export const PHONE_TALL = "min-h-10 sm:min-h-0 [@media(hover:none)_and_(pointer:coarse)_and_(height<30rem)]:min-h-10";

/** A small control kept 36px tall on phones, whatever font size the look gives it. */
export const PHONE_TAP_H = "min-h-9 sm:min-h-0 [@media(hover:none)_and_(pointer:coarse)_and_(height<30rem)]:min-h-9";

/**
 * Asks before a one-tap delete or cancel on a touch screen. There a finger can land on the icon
 * next to the one meant, and the button's title — the only place it says what it does — never
 * shows; the question says it instead. With a mouse it goes straight through, as it always has.
 */
export function confirmOnTouch(message: string) {
  return !window.matchMedia("(hover: none)").matches || window.confirm(message);
}
