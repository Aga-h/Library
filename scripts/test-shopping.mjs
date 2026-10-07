// Shopping. The address becomes a link on the page, so anything that isn't plainly a web page must
// be refused; typed categories must file with the ones already there.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-shopping.mjs
import {
  normaliseShopUrl, hostOf, nameFromUrl, cleanCategory, canonicalCategory, categoryOptions,
  groupByCategory, filterShops, lineCodes, stationCode, lineHue, DEFAULT_CATEGORIES,
} from "../lib/shopping.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}

// ── addresses ────────────────────────────────────────────────────────────────
eq(normaliseShopUrl("zara.com"), "https://zara.com/", "a bare domain gets https");
eq(normaliseShopUrl("  www.zara.com/tr/en  "), "https://www.zara.com/tr/en", "trimmed, path kept");
eq(normaliseShopUrl("http://example-shop.co.uk"), "http://example-shop.co.uk/", "http kept as typed");
eq(normaliseShopUrl("HTTPS://Store.Apple.com/"), "https://store.apple.com/", "scheme and host lower-cased");
eq(normaliseShopUrl("//zara.com"), "https://zara.com/", "protocol-relative gets https");
eq(normaliseShopUrl("https://trendyol.com/?q=a b"), null, "spaces are not an address");
eq(normaliseShopUrl("javascript:alert(1)"), null, "javascript: refused — it would run on click");
eq(normaliseShopUrl("JavaScript:alert(1)"), null, "…in any case");
eq(normaliseShopUrl("data:text/html,hi"), null, "data: refused");
eq(normaliseShopUrl("ftp://files.example.com"), null, "only web pages");
eq(normaliseShopUrl("https://shop"), null, "a host without a dot is a typo");
eq(normaliseShopUrl("https://user:pw@zara.com"), null, "credentials in a link are refused");
eq(normaliseShopUrl(""), null, "empty");
eq(normaliseShopUrl("not a url"), null, "words");

eq(hostOf("https://www.zara.com/tr/"), "zara.com", "www dropped for display");
eq(hostOf("https://store.steampowered.com/"), "store.steampowered.com", "other subdomains kept");

eq(nameFromUrl("https://www.zara.com/tr/"), "Zara", "brand from the domain");
eq(nameFromUrl("https://www.boyner.com.tr/"), "Boyner", "…past com.tr");
eq(nameFromUrl("https://www.amazon.co.uk/"), "Amazon", "…past co.uk");
eq(nameFromUrl("https://store.steampowered.com/"), "Steampowered", "the registered name, not the subdomain");
eq(nameFromUrl("https://hepsiburada.com"), "Hepsiburada", "plain .com");
eq(nameFromUrl("https://co.uk/"), "Co", "a bare second level is still a name");

// ── categories ───────────────────────────────────────────────────────────────
eq(cleanCategory("  home   office "), "home office", "trimmed and collapsed");
eq(canonicalCategory("clothing", ["Clothing", "Tech"]), "Clothing", "files with the existing spelling");
eq(canonicalCategory(" TECH ", ["Clothing", "Tech"]), "Tech", "…whatever the case and spacing");
eq(canonicalCategory("Vinyl", ["Clothing"]), "Vinyl", "a new one is kept as typed");
eq(categoryOptions(["Vinyl", "clothing"]).slice(0, 3), ["clothing", "Vinyl", "Shoes"], "in-use first (A–Z), then suggestions not already there");
eq(categoryOptions([]), DEFAULT_CATEGORIES, "nothing in use: the suggestions");

// ── grouping and search ──────────────────────────────────────────────────────
const shop = (id, name, category, liked = null, disliked = null, url = `https://${name.toLowerCase()}.com/`) =>
  ({ id, name, url, category, liked, disliked });
const shops = [
  shop("1", "Zara", "Clothing", "Fast delivery", "Sizing runs small"),
  shop("2", "Apple", "Tech", "Great support"),
  shop("3", "Bershka", "Clothing", null, "Returns are slow"),
  shop("4", "Steam", "Gaming"),
];
eq(groupByCategory(shops).map((g) => [g.category, g.shops.map((s) => s.name)]),
  [["Clothing", ["Bershka", "Zara"]], ["Gaming", ["Steam"]], ["Tech", ["Apple"]]], "lines A–Z, stations A–Z");
eq(filterShops(shops, { category: "Clothing" }).map((s) => s.id), ["1", "3"], "one category");
eq(filterShops(shops, { q: "returns" }).map((s) => s.id), ["3"], "searches what you didn't like");
eq(filterShops(shops, { q: "SUPPORT" }).map((s) => s.id), ["2"], "…and what you liked, any case");
eq(filterShops(shops, { q: "zara.com" }).map((s) => s.id), ["1"], "…and the address");
eq(filterShops(shops, { q: "tech" }).map((s) => s.id), ["2"], "…and the category");
eq(filterShops(shops, { q: "  " }).length, 4, "a blank search matches everything");
eq(filterShops(shops, { q: "zara", category: "Tech" }).length, 0, "both filters apply");
const withProducts = [
  { ...shop("5", "Uniqlo", "Clothing"), products: [{ name: "Heattech crew neck", comment: "Warm, but pills after a month" }] },
  { ...shop("6", "IKEA", "Home"), products: [{ name: "Kallax shelf", comment: null }] },
];
eq(filterShops(withProducts, { q: "heattech" }).map((s) => s.id), ["5"], "finds a shop by its product");
eq(filterShops(withProducts, { q: "pills" }).map((s) => s.id), ["5"], "…and by what you said about it");
eq(filterShops(withProducts, { q: "kallax" }).map((s) => s.id), ["6"], "a product with no comment still matches by name");
eq(filterShops(withProducts, { q: "sofa" }).length, 0, "no match");

// ── line codes ───────────────────────────────────────────────────────────────
eq([...lineCodes(["Clothing", "Tech", "Gaming"])], [["Clothing", "C"], ["Tech", "T"], ["Gaming", "G"]], "first letters");
eq([...lineCodes(["Clothing", "Cosmetics", "Coffee"])], [["Clothing", "C"], ["Cosmetics", "CO"], ["Coffee", "COF"]], "a taken letter takes another");
eq([...lineCodes(["Tech", "T"])], [["Tech", "T"], ["T", "T2"]], "nothing left to take: numbered");
eq([...lineCodes(["Food & Drink"])], [["Food & Drink", "F"]], "punctuation ignored");
eq([...lineCodes(["Ev eşyası"])], [["Ev eşyası", "E"]], "non-English letters work");
eq(stationCode("C", 0), "C01", "stations start at 01");
eq(stationCode("CO", 11), "CO12", "…two digits");

eq(lineHue("Clothing"), "pink", "fixed hue");
eq(lineHue("clothing"), "pink", "…in any case");
eq(lineHue("Vinyl"), lineHue("vinyl"), "a hashed hue is stable");

console.log(`${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
