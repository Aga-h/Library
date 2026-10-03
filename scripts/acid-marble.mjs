// Renders the Acid look's marbled liquid (app/acid-marble.webp) once, as a tile that repeats
// seamlessly both ways. Pre-rendered because an SVG filter this size, recomputed whenever the
// liquid moved, made the look slow; a bitmap can be slid around for free.
//
// Stripes in the posters' inks repeat every P px and the tile is a whole number of stripes tall;
// the warp is Perlin noise stitched over exactly one tile, so the warped result repeats too.
// Rendered at 4x and scaled down to 1.5x, which smooths the warp's jagged edges.
//
// Needs playwright-core and a Chromium (not project dependencies), e.g.:
//   NODE_PATH=/path/to/node_modules CHROMIUM=/path/to/chrome node scripts/acid-marble.mjs
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../app/acid-marble.webp", import.meta.url));
const W = 600, H = 1248;
const P = 156;
const stripes = [["#8cff3a", 0, 33], ["#f2f2ee", 45, 8], ["#a18bff", 63, 18], ["#8cff3a", 93, 21], ["#ff7a2e", 126, 6], ["#f2f2ee", 138, 5]];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><pattern id="s" width="${W}" height="${P}" patternUnits="userSpaceOnUse"><rect width="${W}" height="${P}" fill="#050505"/>
${stripes.map(([c, y, h]) => `<rect y="${y}" width="${W}" height="${h}" fill="${c}"/>`).join("")}</pattern>
<filter id="w" filterUnits="userSpaceOnUse" x="-500" y="-700" width="${W + 1000}" height="${H + 1400}" color-interpolation-filters="sRGB">
<feTurbulence x="0" y="0" width="${W}" height="${H}" type="fractalNoise" baseFrequency="0.0026" numOctaves="2" seed="7" stitchTiles="stitch" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="700" xChannelSelector="R" yChannelSelector="G"/></filter></defs>
<rect x="-500" y="-700" width="${W + 1000}" height="${H + 1400}" fill="url(#s)" filter="url(#w)"/></svg>`;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 4 });
await page.setContent(`<style>body{margin:0}</style>${svg}`);
await page.waitForTimeout(300);
const png = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
const webp = await page.evaluate(async (b64) => {
  const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
  // Down from 4x to 1.5x with smoothing: anti-aliases the warp's nearest-neighbour edges.
  const c = document.createElement("canvas"); c.width = img.width * 3 / 8; c.height = img.height * 3 / 8;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/webp", 0.76).split(",")[1];
}, png.toString("base64"));
writeFileSync(OUT, Buffer.from(webp, "base64"));
await b.close();
console.log(`wrote ${OUT} (${Buffer.from(webp, "base64").length} bytes)`);
