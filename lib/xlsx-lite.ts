// Reading the first sheet of an .xlsx file, just enough to import a list from it: cell text and
// each cell's hyperlink. No dependency — an .xlsx is a zip of XML files, and both the browser and
// Node can inflate zip entries with DecompressionStream.
//
// Pure apart from DecompressionStream, so the tests can run it on a real file.

export interface SheetCell {
  text: string;
  /** The cell's hyperlink target, when it has one. */
  link: string | null;
}

/** Rows of cells, by position: rows[0][0] is A1. Missing cells are empty. */
export type Sheet = SheetCell[][];

const EMPTY: SheetCell = { text: "", link: null };

function u16(b: Uint8Array, at: number) { return b[at] | (b[at + 1] << 8); }
function u32(b: Uint8Array, at: number) { return (u16(b, at) | (u16(b, at + 2) << 16)) >>> 0; }

async function inflate(data: Uint8Array, format: "deflate-raw" | "gzip"): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Un-gzips a .gz file. */
export async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  return inflate(data, "gzip");
}

/** The files in a zip, by name — read through the central directory, as unzip does. */
export async function unzip(data: Uint8Array, wanted: (name: string) => boolean): Promise<Map<string, string>> {
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 65_535); i--) {
    if (u32(data, i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("That isn't an .xlsx file.");

  const files = new Map<string, string>();
  const decoder = new TextDecoder();
  let at = u32(data, end + 16);
  for (let n = u16(data, end + 10); n > 0; n--) {
    if (u32(data, at) !== 0x02014b50) throw new Error("That .xlsx file is damaged.");
    const method = u16(data, at + 10);
    const size = u32(data, at + 20);
    const nameLength = u16(data, at + 28);
    const name = decoder.decode(data.subarray(at + 46, at + 46 + nameLength));
    const local = u32(data, at + 42);
    at += 46 + nameLength + u16(data, at + 30) + u16(data, at + 32);
    if (!wanted(name)) continue;

    const start = local + 30 + u16(data, local + 26) + u16(data, local + 28);
    const raw = data.subarray(start, start + size);
    if (method === 0) files.set(name, decoder.decode(raw));
    else if (method === 8) files.set(name, decoder.decode(await inflate(raw, "deflate-raw")));
    else throw new Error("That .xlsx file uses a compression this can't read.");
  }
  return files;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? decodeXml(m[1]) : null;
}

/** All the <t> text inside a piece of XML, joined — rich text is split into several runs. */
function texts(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");
}

/** "D7" → [6, 3]. */
function position(ref: string): [number, number] | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + ch.charCodeAt(0) - 64;
  return [Number(m[2]) - 1, col - 1];
}

/** The workbook's first worksheet: its path inside the zip. */
function firstSheetPath(files: Map<string, string>): string | null {
  const workbook = files.get("xl/workbook.xml");
  const rels = files.get("xl/_rels/workbook.xml.rels");
  const sheet = workbook?.match(/<sheet\s[^>]*>/)?.[0];
  const id = sheet ? attr(sheet, "r:id") : null;
  if (id && rels) {
    for (const rel of rels.match(/<Relationship\s[^>]*>/g) ?? []) {
      if (attr(rel, "Id") !== id) continue;
      const target = attr(rel, "Target") ?? "";
      const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
      if (files.has(path)) return path;
    }
  }
  return [...files.keys()].filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0] ?? null;
}

/** The first sheet of an .xlsx file: every cell's text and hyperlink. */
export async function readFirstSheet(data: Uint8Array): Promise<Sheet> {
  const files = await unzip(data, (n) => n.startsWith("xl/") && n.endsWith(".xml") || n.endsWith(".rels"));
  const path = firstSheetPath(files);
  const xml = path ? files.get(path) : undefined;
  if (!xml) throw new Error("That .xlsx file has no sheet in it.");

  const shared = [...(files.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));

  const rows: Sheet = [];
  for (const m of xml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const tag = ` ${m[1]}`;
    const at = position(attr(tag, "r") ?? "");
    if (!at) continue;
    const body = m[2] ?? "";
    const type = attr(tag, "t");
    const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    const text =
      type === "s" ? shared[Number(value)] ?? "" :
      type === "inlineStr" ? texts(body) :
      value !== undefined ? decodeXml(value) : "";
    (rows[at[0]] ??= [])[at[1]] = { text, link: null };
  }

  // Hyperlinks name a cell and a relationship; the relationship holds the address.
  const relsPath = path!.replace(/([^/]+)$/, "_rels/$1.rels");
  const targets = new Map<string, string>();
  for (const rel of files.get(relsPath)?.match(/<Relationship\s[^>]*>/g) ?? []) {
    const id = attr(rel, "Id");
    const target = attr(rel, "Target");
    if (id && target) targets.set(id, target);
  }
  for (const link of xml.match(/<hyperlink\s[^>]*>/g) ?? []) {
    const at = position((attr(link, "ref") ?? "").split(":")[0]);
    const target = targets.get(attr(link, "r:id") ?? "");
    if (!at || !target) continue;
    const row = (rows[at[0]] ??= []);
    row[at[1]] = { ...(row[at[1]] ?? EMPTY), link: target };
  }

  for (let r = 0; r < rows.length; r++) {
    rows[r] ??= [];
    for (let c = 0; c < rows[r].length; c++) rows[r][c] ??= EMPTY;
  }
  return rows;
}
