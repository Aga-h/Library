// graphify writes graph.html with a <script src="https://unpkg.com/vis-network…">.
// That makes the page useless anywhere the network is blocked — offline, and inside
// the Claude artifact viewer, whose CSP refuses external hosts. Since graph.html is
// committed, run this after every `/graphify .` to inline the library instead.
//
//   npm run graph:seal
//
// The tag carries an SRI hash; we verify our local copy against it, so this can only
// ever inline exactly the bytes the page asked for.

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const HTML = "graphify-out/graph.html";
const require = createRequire(import.meta.url);

const html = readFileSync(HTML, "utf8");

const start = html.indexOf('<script src="https://unpkg.com/vis-network');
if (start === -1) {
  console.log("graph.html is already sealed — no external script tag. Nothing to do.");
  process.exit(0);
}
const end = html.indexOf("</script>", start) + "</script>".length;
const tag = html.slice(start, end);

const expected = tag.match(/integrity="sha384-([^"]+)"/)?.[1];
if (!expected) {
  console.error("No SRI hash on the script tag — refusing to inline something unverifiable.");
  process.exit(1);
}

const libPath = require.resolve("vis-network/standalone/umd/vis-network.min.js");
const lib = readFileSync(libPath);
const actual = createHash("sha384").update(lib).digest("base64");

if (actual !== expected) {
  console.error(
    `SRI mismatch — refusing to inline.\n  page expects: ${expected}\n  local copy:   ${actual}\n` +
    `Install the version the page asks for (see the tag in ${HTML}).`
  );
  process.exit(1);
}

const banner = "<script>\n/* vis-network (MIT), inlined so this page renders with no network */\n";
writeFileSync(HTML, html.slice(0, start) + banner + lib.toString("utf8") + "\n</script>" + html.slice(end), "utf8");

const left = (readFileSync(HTML, "utf8").match(/src="https?:\/\//g) || []).length;
console.log(`Sealed ${HTML} — vis-network inlined, SRI verified, ${left} external references remain.`);
