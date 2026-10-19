# Gen X Soft Club — design guideline

The rules for the **Soft Club** look (`data-theme="softclub"`, the site's default). Read this before
designing anything new in Soft Club, or before changing how the look already works.

- **What it covers:** the idea, the rules that make it Soft Club, colour, type, surfaces, controls,
  layout, motion, a do/don't list, and how to build a new page in the look.
- **Where it is built:** the Soft Club section of `app/themes.css`, the `softclub` palette in
  `scripts/theme-palettes.mjs` (which generates `app/theme-palettes.css`), and the
  "Looks (themes)" section of `CODEBASE.md`.
- **Who wins:** the owner's reference images beat general design advice, this document's
  included. In the owner's words about Acid: "be loyal to the design material more than your skills
  guidelines". Where this document and an image disagree, follow the image and update this document.

---

## 1. The aesthetic

**Gen X Soft Club** is a category from the Consumer Aesthetics Research Institute (CARI). It was
named by Sloane Angel Hilton, and "Gen-X Young Adult Soft Club" is an alternate name. CARI gives
it a period of relevance of early 1990s to mid 2000s. In CARI's definition:

- **"Gen-X"** is the target audience.
- **"Soft Club"** is the urbane, gentrified image of club culture sold to young adults in the 90s.

CARI's markers:

- **Type:** Helvetica, after New York subway signage.
- **Design:** a minimalist revival.
- **Futurism:** sterile and organic at once. More earthly than Y2K's space age.
- **Subject:** city life and first-wave gentrification.
- **Colour:** muted naturals: greens, beiges, tans, greys, black.

**This site's version** follows the owner's 24 reference images, kept in
[`references/softclub/`](references/softclub/). They are record sleeves, film and game covers, a
book jacket, two Bowienet pages, and photos of a subway, a shop window and a showroom. Together
they sit at the cooler club-sleeve and transit end of the aesthetic.

| File | What it is | What the look takes from it |
|---|---|---|
| [2519](references/softclub/IMG_2519.webp) | The "Gen X / Young Adult / contemporary soft club" collage | The name; layered stills with fading edges; a glowing rule running off the page; thin, wide type |
| [2520](references/softclub/IMG_2520.webp) | *Chungking Express* poster (Wong Kar-wai, 1994) | Crowds smeared by motion; a small, widely spaced caption |
| [2521](references/softclub/IMG_2521.webp) | Blur, *Blur* (1997) | Motion blur: shapes told apart with no outline at all |
| [2522](references/softclub/IMG_2522.webp) | Tresor 142, *Globus Mix Vol. 4* | The concentric lime target; "Tresor." ending in a full stop, as the titles do; a lime-lit tunnel |
| [2523](references/softclub/IMG_2523.webp) | Bowienet home page (1998) | Washed-out white haze; thin columns of small text; dotted column rules; index tabs |
| [2524](references/softclub/IMG_2524.webp) | Ruxpin, *Midnight Drive* | A fluorescent-green metro station with a train passing: the transit setting |
| [2525](references/softclub/IMG_2525.webp) | Junkie XL, *Saturday Teenage Kick* | Light bars streaking right; `<software release …>` in angle brackets, hence the `<label>`s; "V1.13X", hence `ver.2` |
| [2526](references/softclub/IMG_2526.webp) | Radiohead, *OK Computer* (1997) | A pale blue-white wash; motorway line drawings; figures fading into the haze |
| [2527](references/softclub/IMG_2527.webp) | Kaskade, *Gonna Make It* | Out-of-focus colour blobs, used for the stat boxes; thin lowercase type on a hairline |
| [2528](references/softclub/IMG_2528.webp) | Sneaker Pimps, *Becoming X* | The whole photo in one blue cast, with line art over it |
| [2529](references/softclub/IMG_2529.webp) | Nine Days, *The Madding Crowd* | Commuters smeared by motion in a green-lit hall: things arriving blurred; the title in a band of blue |
| [2530](references/softclub/IMG_2530.webp) | *Deus Ex* (2000) cover | A violet-blue city at night under a column of light |
| [2531](references/softclub/IMG_2531.webp) | *Phase Paradox* cover | A face behind a cyan grid; Japanese type; small portraits in a column |
| [2532](references/softclub/IMG_2532.webp) | Ratty, *Sunrise (Here I Am)* | An LED dot-matrix road sign: the figures in DotGothic16 |
| [2533](references/softclub/IMG_2533.webp) | T.M.Revolution, *Progress* | Dot-matrix type at full size; a green-lit tunnel |
| [2534](references/softclub/IMG_2534.webp) | A Japanese car showroom | Brushed steel, a lit turntable, cool white light: the sterile side of the futurism |
| [2535](references/softclub/IMG_2535.webp) | Bloomingdale's "Power Flower" window at night | White line drawings glowing on cyan light boxes; passers-by blurred |
| [2536](references/softclub/IMG_2536.webp) | Black-and-white video still of a tower against the sun | Camcorder grain and a timestamp over the picture: the grain and scanlines |
| [2537](references/softclub/IMG_2537.webp) | New York subway roll signs (F train, "179 St, Jamaica") | The roll sign: the active menu item and the phone top bar |
| [2538](references/softclub/IMG_2538.webp) | Nintendo GameCube ad | The capsule text box: secondary buttons |
| [2539](references/softclub/IMG_2539.webp) | David Mitchell, *Ghostwritten* (book cover) | Light streaks; the title echoed and blurred |
| [2540](references/softclub/IMG_2540.webp) | Bowienet "Inside" page | A pale blue pixel mosaic; letters spaced down a column |
| [2541](references/softclub/IMG_2541.webp) | *Ambient Lounge 5* | Bands between hairline rules, open at the sides (the panels); a Barcelona chair in cool daylight |
| [2542](references/softclub/IMG_2542.webp) | *Jazzy Chill Out* (Sacred Spirit Vol. 8) | Light trails; the row of fading orange dots in the page header |

**What the whole set shows:**

- **Three casts.**
  - Icy blue-cyan, in most of the set.
  - Fluorescent subway green: Tresor, Ruxpin, Nine Days, T.M.Revolution, *Phase Paradox*.
  - Warm sodium orange: Blur, *Jazzy Chill Out*, Ratty.

  The site keeps blue-cyan as its cast and uses the other two as its lights, lime and orange.
- **People and trains smeared by motion:** Blur, *Chungking Express*, Nine Days, *OK Computer*.
- **Tunnels, stations and signage:** roll signs, LED boards, platform type.
- **Thin lowercase sans:** Bowienet, Kaskade, *Ambient Lounge*.
- **Washed-out white haze:** Bowienet, *OK Computer*, *Ambient Lounge*.

**The idea in one line:** *a city seen from a moving train, in one icy cyan cast.*

**A known difference:** CARI's colour is muted naturals, while the owner's references are an icy
cyan cast. The site follows the owner. The natural palette is a valid other version of the
aesthetic, but it is not this one. Don't drift toward beige.

---

## 2. The rules that make it Soft Club

Each rule comes from the owner's feedback on an earlier version. Breaking one is a regression, not
a style choice.

1. **No outlines, anywhere.** "In gen x soft club its all blurry and there are no definite lines
   yet you can distinguish the shapes with the colors and by the blurry lines." Every border is
   transparent. Shapes are separated by colour, haze and soft streaks.
2. **No white cards.** White panels "look like a cheaper way of conveying shapes." Group things
   with film bands, light bars and colour blobs (§5).
3. **Lines are graphics laid over the photo, not boxes round content.** Hairline frames, long
   rules, data text and the subway map live in the backdrop. A line never encloses a piece of UI.
4. **One colour cast.** Everything is washed in cyan-blue. Lime and sodium orange are the only
   lights. Ink is deep navy, never black.
5. **Things travel sideways.** Layout runs horizontally and off the right edge. Motion goes left
   to right. The one vertical move is a roll sign, because real roll signs roll.
6. **It must have soul.** The failure mode is "corporate slop with no soul". If a screen could
   belong to any SaaS dashboard, or looks like Classic with new colours, it is wrong.
7. **Motion is expected,** but it is choreographed (§9). Only the page's arrival plays unasked.
8. **Drawn, not pictured.** Everything is CSS and inline SVG. No stock images and no AI images,
   per the original brief. Only the user's own content is a photo, such as book covers.

---

## 3. Colour

### Core tokens

These are defined on `:root[data-theme="softclub"]` in `app/themes.css`.

| Token | Value | Role |
|---|---|---|
| `--sc-ink` | `#0e1a24` | Titles and strong text. Navy, never black |
| `--sc-cyan` | `#2a96d4` | The cast: tabs, underlines, glows, label text, track washes |
| `--sc-lime` | `#a9d22c` | The "on" light: title full stops, the active menu number, the `ver.2` tag, the target, "liked" |
| `--sc-orange` | `#f2902e` | Sodium light: the header's fading dots, "didn't like". Use sparingly |

### Supporting values

| Value | Where |
|---|---|
| `#13283a` / `rgb(19 40 58)` | The navy roll sign: the active menu item, primary buttons, badges |
| `#17609f` → `#2a96d4` | The brand smear, deep to bright |
| `#f4f8fb` | Text on navy |
| `rgb(206 233 250 / 0.1–0.55)` | Panel film |
| `rgb(244 250 253 / 0.97)` | Anything floating over the page: dialogs, dropdowns, the look menu |
| `#8dbfdc` | The scrollbar thumb |

### The grey ramp

The ramp is cool grey with a cyan cast. It comes from `scripts/theme-palettes.mjs`, and white is
`#fbfdfe`.

| 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|
| `#eaf3f8` | `#dfecf4` | `#c9dce8` | `#a9c3d4` | `#7b9bb1` | `#58778e` | `#436076` | `#2e485d` | `#1d3446` | `#0e2133` | `#07131e` |

The 17 hue ramps are generated from one hue angle and a peak chroma each, so Tailwind classes like
`bg-green-100 text-green-700` keep working. Edit the script and re-run it. Never hand-edit
`app/theme-palettes.css`.

### The sky behind everything

A vertical gradient: `#c4d3ef` (lavender) → `#dcedf8` → `#c1e2e6` (aqua). It is lit by soft radial
pools:

- lavender at the top left
- cyan at the top right
- aqua at the bottom right
- a white bloom in the middle

### How to use colour

- **Proportion, as a rule of thumb:** about 80% haze and film, about 15% cyan, under 5% lime and
  orange together. Lime is a pinpoint, not a fill.
- **A tint is a light, not a paint.** Each Tailwind tint class sets two variables:
  - `--sc-glow`: its own colour, for glows
  - `--sc-blob`: its 200 shade, to draw bars and blobs with

  Tinted things glow in their own colour rather than sitting as flat swatches. A new tint class
  in use needs those two lines added.
- **No hex in components.** Use `var(--color-*)` so every look can recolour it. For SVG, pass the
  colour through `style`, since presentation attributes can't read CSS variables.
- **Meaning is never colour alone.** Liked and didn't-like, or on and off, also need a word, an
  icon or a position.

### Contrast, as built

Measured against gray-50 `#eaf3f8`, the lightest ground, and lavender `#c4d3ef`, the darkest:

| Ink | On `#eaf3f8` | On `#c4d3ef` | Verdict |
|---|---|---|---|
| `--sc-ink` | 15.7 | 11.7 | Passes everywhere |
| gray-700 | 8.5 | 6.3 | Passes |
| gray-600 (menu items) | 5.9 | 4.4 | Passes on light ground, borderline on lavender |
| gray-500 (title readout) | 4.2 | 3.1 | **Below AA (4.5) for small text** |
| `--sc-cyan` (labels) | 2.9 | 2.2 | **Fails for text.** Fine for glows, rules and tabs |
| `#17609f` brand blue | 5.8 | 4.3 | The cyan to use for small text |
| lime, orange | 1.6, 2.1 | — | Decoration only, never text |
| `#f4f8fb` on navy | 14.1 | — | Passes |
| ink on lime (`ver.2`) | 10.0 | — | Passes |

**For new work:** small text you colour yourself goes in `#17609f` or darker, and `#2a96d4` is kept
for light. The shared label and readout styles stay as they are until the owner decides on the fix
in §12, so that one page doesn't mix two cyans.

---

## 4. Type

| Role | Face | How it is set |
|---|---|---|
| Titles (`h1`, `h2.text-2xl`, brand) | **Lexend Exa** | Weight 300, **lowercase**, tracking −0.045em, `--sc-ink`, ending in a **lime full stop** at 700: "books." |
| Reading text | **Helvetica Neue / Helvetica**, falling back to Archivo | The house sans |
| Labels (`.uppercase.tracking-wide`) | **Share Tech Mono** | Lowercase, tracking 0.02em, wrapped in `<angle brackets>` at 60% opacity, like a release note |
| The line under a title | Share Tech Mono | 0.8rem, grey: a technical readout |
| Big figures (`.text-2xl.font-bold`) | **DotGothic16** | Weight 400, tracking 0.04em: an LED platform board |
| Small codes (menu numbers, tags) | Share Tech Mono | 9–10px; menu numbers in cyan, the active one in lime |

Fonts load through `next/font` with `preload: false`, so only the active look's faces download.

**Voice:**

- Lowercase titles and labels.
- Terse, like a sleeve credit or a release note.
- Numbers as signage: track numbers `01 02 03`, station codes `C01`, version tags `ver.2`.
- The active menu item is the one exception: normal case at 600, because it is the lit sign.

**Don't:**

- uppercase or bold display titles
- italic
- centred hero type
- a second display face
- emoji

---

## 5. Surfaces: showing a shape without a line

This is the heart of the look. Each kind of UI has one device, taken from one reference. The skin
catches ordinary Tailwind classes, so pages get the look without being edited.

| What it is | The device | Reference | Caught by |
|---|---|---|---|
| **A container** (card, form, section) | A **film band**. Pale blue film, brightest at the top, between hairline rules and open at the sides. The top is a doubled rule, cyan over white, fading out to the right; the foot is a single white rule. A short cyan **index tab** (34×3px) sits at the top left. It frosts what is behind it (`backdrop-filter: blur(7px)`). Radius 0 | Ambient Lounge, Bowienet | `.bg-white` + `.rounded-xl` / `.rounded-2xl` |
| **A card that is a link** | The same band without the frosting, since these can come by the dozen. It brightens on hover | — | `a.bg-white.rounded-xl` |
| **A row or header strip** | A **light bar**: a bright 1px top edge over a pale streak that fades out to the right | Junkie XL | `.bg-gray-50` |
| **A tinted box or strip** | A bar of its own colour (`--sc-blob`) fading out to the right | The tracklist | `.bg-{hue}-50/100` |
| **A stat** (figure over label) | A **colour blob**: a radial wash of its tint with no edge at all | Kaskade | tinted `.flex-col.items-center.justify-center` |
| **A divider** | A **dotted rule**: cyan at 50%, 1px on and 3px off | Bowienet | `divide-y` |
| **A list of sections** | A **CD tracklist**: one streak per track, numbered in LED, washed with the section's colour at its start. Columns are number 2.75rem, title up to 13rem, meta, then arrow 1.25rem | CD singles | `.theme-tile`, `a.bg-gradient-to-br` |
| **Categories and their members** | A **metro map**: each category is a glowing line with a ring badge, each member a station with a code (`C01`) | Tokyo strip maps | Shopping, `.shop-line-*` |
| **Something floating over the page** (dialog, dropdown, menu) | Nearly opaque pale film, `rgb(244 250 253 / 0.97)`. Legibility beats haze here | — | `.fixed`, `.absolute`, `.theme-picker-menu` |
| **A photo or cover** | It fades into the haze at its edges (`mask-image`: 6% at the sides, 5% at the top, 16% at the foot) | The Gen X collage | `img.object-cover` |
| **A cover not yet found** | A pane of pale film lit from the top corner | — | `.bg-gray-100[class*="aspect-"]` |

**Radii:**

- 0: bands, bars, tracks and menu items
- full: capsule buttons
- 6px: the navy roll sign
- 3px: fields
- 2px: tags and swatches

**Depth is light, not shadow.** Every Tailwind shadow is recoloured to a white glow
(`--tw-shadow-color: rgb(255 255 255 / 0.9)`). Nothing casts a dark drop shadow. Things glow from
within or blur what is behind them.

**Frosting and stacking:** a frosted panel is its own stacking context. A panel holding an open
dropdown (`ul.absolute`) is lifted to `z-index: 5` so the dropdown isn't buried under the next
panel. New frosted surfaces need the same care.

---

## 6. Controls

| Control | Resting | Hover | Press |
|---|---|---|---|
| **Primary** (`bg-gray-900`) | A **navy roll sign**: `rgb(19 40 58 / 0.9)`, text `#f4f8fb`, radius 6px, a soft glow and ink trailing ±26px to either side | `#1d3a52` | Lights up **at once** to `#2c5a7e` with a cyan glow, then fades back over 0.45s |
| **Secondary** (outlined or white button) | A **GameCube capsule**: a 7% cyan tint, a 1px inset white edge and a 9px cyan glow | 14% tint, 14px glow | 32% tint, 22px glow, instant |
| **Full-width choice** (quiz answer, list pick) | A light bar, not a capsule | The bar warms to cyan | — |
| **Solid colour** (red, green, amber…) | Glows in its own colour (`--sc-glow`) and trails sideways | — | A stronger glow, instant |
| **Chip or tinted pill** | Keeps its fill and glows 6px in its colour | — | — |
| **Field** | A cooler tint `rgb(214 236 249 / 0.6)`, radius 3px, a **blurred cyan underline** | — | **Focus:** brighter fill, an 18px cyan glow, and the underline **scans in** from the left |

- **Keyboard focus** is a 2px cyan outline at 70%, offset 3px. It is the one hard line in the look,
  and it stays: accessibility outranks rule 1.
- **Disabled controls** (guidance for new work) lose their glow and their hover. Dim them with
  opacity, not with grey borders.

---

## 7. Atmosphere: the layers behind the page

From back to front:

1. **The city** (`body::after`, z −2): the sky gradient plus horizontal light streaks (train
   windows smeared into bars), a column of daylight and a low lime streak. It is blurred 14px as
   a whole and bled 80px past the screen so the blur never shows an edge.
2. **The line art** (`:root::before`, z −1), slightly out of focus (blur 0.35px plus white and
   cyan glows):
   - a column of random data text running down the left edge, rotated 90°
   - a pair of offset hairline frames
   - long rules running off the page
   - a subway map in cyan, teal, lime and orange with white stations

   Beside a sidebar (lg up), the data text runs down the sidebar's edge. It is the sidebar's only
   divider.
3. **The target** (`:root::after`): Tresor's concentric lime rings, cropped by the top-right
   corner. Where there is a sidebar, it sits under the menu instead, like a record label's emblem.
4. **Grain and scanlines** (`body::before`, z 70): fractal noise and a 3px line pattern at 9%,
   multiplied, faint as camcorder tape.

**Rules:**

- The backdrop is fixed, and the content passes over it.
- Nothing the user needs to read lives in the backdrop.
- On a phone (under 640px), the frames and map are removed, since the content covers them anyway.
  The data text and rules stay.

---

## 8. Layout and the set pieces

- **The sidebar** is a wash of daylight down the left that fades into the haze. It is not a
  column, and it has no edge.
- **The brand** is a blue smear (`#17609f → #2a96d4 → transparent`):
  - the name in lowercase Lexend Exa 300
  - a blurred lime underline
  - a lime `ver.2` tag
- **The menu:**
  - items are numbered `01 02 03`, like Bowienet's tiles, and their icons are hidden
  - each item is feathered top and bottom (a streak, not a plate)
  - the open page is the **navy roll sign**, with its number in lime
- **Page headers** have no bar. They are a brighter haze ended by a glowing rule that runs off the
  page, plus a row of seven orange dots fading out (*Jazzy Chill Out*). The dots are hidden on a
  phone.
- **The phone top bar** is a frosted strip (`blur(18px) saturate(1.15)`) with the section name set
  like the brand and the current page as a roll sign.
- **Composition:**
  - asymmetric and left-anchored
  - long horizontals that run off to the right
  - plenty of haze between groups instead of boxes
- **Avoid:** a centred, evenly spaced grid of equal cards. That is the "corporate slop" layout.

---

## 9. Motion

**The idea:** the city seen from a moving train.

- Things travel **sideways**, not up.
- They **arrive smeared and resolve into focus**, like the blur sleeve.
- Light **passes along** them, like *Jazzy Chill Out*'s trails.
- Signs **roll** to a new destination.
- Numbers **warm up** like a dot-matrix board.

**One curve:** `--sc-ease: cubic-bezier(0.16, 0.84, 0.24, 1)`. Fast, then settling, like a train
braking into a platform.

| Moment | What happens | Timing |
|---|---|---|
| **Arrival** (the one thing that plays unasked) | The page's blocks pull in one after another, like carriages: from −18px, `blur(6px)` and transparent | 520ms each, staggered 0 / 60 / 120 / 180 / 240ms |
| Tracklist arrival | Tracks arrive the same way, track by track | 560ms each, 80ms to 465ms in 55ms steps |
| **LED figures** | They flicker on as their block stops (`sc-led`) | 700ms linear, 260ms after the block's delay (`--sc-delay`) |
| **Hovering or focusing a track** | A light passes along it, behind the words; the track slides 6px right | 750ms |
| **Changing page** | The active menu item's sign **rolls** up to the new page, and its label rolls in behind | 420ms, label +40ms |
| **Opening a menu or dropdown** | It **pulls into focus**: from −8px and `blur(4px)` | 240ms |
| **The phone menu drawer** | It travels in sideways on the house curve | 420ms |
| **Pressing** | The light comes on **at once** (`transition-duration: 0s` on `:active`) and fades out | 450ms fade |
| **Focusing a field** | Its cyan underline scans across | 400ms |
| **Loading** | A light scans across the placeholders, replacing Tailwind's pulse | 1.6s, looping |

**Rules:**

- **Only the arrival is unasked.** Everything else answers something the person did.
- **Cut stock moves.** Progress bars filling on load were cut in review as "the stock dashboard
  move".
- **Use `--sc-delay`** to chain things to the block they sit in, rather than adding new timers.
- **Reduced motion:** all of it sits inside `@media (prefers-reduced-motion: no-preference)`.
  Hover, press and focus states still show; they just don't move. Test that reduced motion leaves
  **0 running animations**.
- **Performance:** keep 60fps.
  - Animate only `transform`, `opacity` and small `filter` blurs on small elements.
  - Never animate `backdrop-filter`, large blurs, or blend modes over large areas. Acid fell to
    31fps on exactly those: `blur(28px)` auras with a screen blend.
  - Pre-render anything heavy.
- **CSS, not JS.** An animation starts when its rule starts applying. That makes the page-change
  roll work off `[data-active]` with no script. The same mechanism means switching to the look
  plays the arrival once.

---

## 10. Motifs

**Use:**

- the concentric target
- the subway map and its stations
- a data-text column
- offset hairline frames
- long rules running off the page
- rows of fading dots
- `<bracketed>` mono labels
- LED digits
- track numbers and station codes
- `ver.` tags
- index tabs
- light bars, film bands and colour blobs
- roll signs

**Don't borrow from the other looks:**

- **Acid:** barcodes, `>>>>` chevrons, HUD or OS window frames, blackletter, sparkles
- **Early Cyber:** pixel dither
- **Cyberdelia:** wireframe floors

**Icons:** the menu's icons give way to numbers, and a track's icon gives way to its number.
Elsewhere, keep lucide icons thin and small, in a muted grey or cyan, never in a filled badge.

---

## 11. Do and don't

| Do | Don't |
|---|---|
| Separate shapes with colour, haze and soft streaks | Draw a border, outline or box round anything (keyboard focus excepted) |
| Group with film bands, light bars and blobs | Use solid white cards |
| Glow from within | Cast dark drop shadows |
| Navy ink | Pure black |
| Lowercase thin wide titles ending in a lime "." | Uppercase or bold headlines |
| Let lines and streaks run off the right edge | Centre everything in an even card grid |
| Lime and orange as pinpoint lights | Fill areas with lime or orange |
| One house curve, sideways travel | Bounces, springs, fade-ups, spinners |
| Signage voice: `01`, `C01`, `ver.2`, `<label>` | Marketing copy, emoji |

**Not to be confused with its neighbours:**

- **Y2K Futurism and McBling:** chrome, space age, gloss, pink and rhinestones.
- **Frutiger Aero:** glossy skeuomorphic bubbles, water and grass.
- **Classic:** this site's original plain grey look.

Soft Club is softer, cooler, earthbound and urban.

---

## 12. Building something new in Soft Club

1. **Start from the classes the skin already catches**, and most of the look comes free:
   - `bg-white rounded-xl` → a film band
   - `bg-gray-50` → a light bar
   - `divide-y` → dotted rules
   - `.theme-tile` → a track
   - `uppercase tracking-wide` → a `<label>`
   - `text-2xl font-bold` → LED figures
   - `bg-gray-900` → the roll sign

   Use the same classes the other looks use, so each look keeps working.
2. **Name the reference.** For anything signature, pick the image it comes from in §1 and
   say so in the CSS comment, as the existing rules do ("like the bands on Ambient Lounge's
   sleeve"). If no reference fits, ask the owner rather than inventing one.
3. **Give it a hook class** (`.shop-line-bullet`, `.theme-nav-item`), and style it under
   `[data-theme="softclub"]` in the Soft Club section of `app/themes.css`. The CSS is unlayered on
   purpose, so it beats Tailwind's utilities without `!important`.
4. **Colour through variables:** `var(--sc-*)` and `var(--color-*)`, never hex in a component.
   Small text you colour yourself goes in `#17609f` or darker (§3).
5. **Motion** goes inside the `no-preference` block, on `--sc-ease`, chained with `--sc-delay`. It
   answers an action unless it is part of the arrival.
6. **Check it:**
   - at 1180px and 390px wide
   - in Chromium with no console errors
   - at 60fps
   - with 0 running animations under reduced motion
   - text contrast at AA or better
   - after deploy, against the **live** CSS, not only the local build (Vercel once dropped
     `@import`ed theme files that worked locally)
7. **Show the owner.** Every past round of this look changed after their feedback. Expect that,
   and record what they said in `.claude/PROGRESS.md`.

### Known gaps

- **Label and readout contrast.** The `<label>` text is cyan at 2.9:1 and the title readout is
  gray-500 at 4.2:1, both under AA for small text. The fix would move label text to `#17609f` and
  the readout to gray-600, keeping cyan for the brackets and glows. It is not done yet because it
  changes the look, so the owner decides.

---

## Sources

- The owner's reference images, in [`references/softclub/`](references/softclub/).
- The owner's feedback, 2026-10-02 to 2026-10-03, recorded in `.claude/PROGRESS.md`.
- [CARI — Gen X Soft Club](https://cari.institute/aesthetics/gen-x-soft-club)
- [Consumer Aesthetics Research Institute — Wikipedia](https://en.wikipedia.org/wiki/Consumer_Aesthetics_Research_Institute)
