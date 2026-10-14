// Just enough of .xlsx to read a sheet's cells — for the MyAnimeList list import, where the list
// arrives as a spreadsheet. An .xlsx is a zip of XML files: this finds the first worksheet and its
// shared strings, inflates them with the platform's DecompressionStream (browsers and Node 18+),
// and reads each row's cells. No formulas, styles or dates — values only. A new dependency would
// have been heavier than this.

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The named files in a zip, as text. Throws if it isn't a zip. */
export async function unzipText(bytes: Uint8Array, wanted: (name: string) => boolean): Promise<Map<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end-of-central-directory record: in the last 22 bytes, or before a comment of up to 64 KB.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip");

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const out = new Map<string, string>();
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== CENTRAL) throw new Error("broken zip");
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!wanted(name)) continue;

    if (view.getUint32(local, true) !== LOCAL) throw new Error("broken zip");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    if (method === 0) out.set(name, decoder.decode(data));
    else if (method === 8) out.set(name, decoder.decode(await inflateRaw(data)));
    else throw new Error(`unsupported compression ${method}`);
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()];
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return String.fromCodePoint(code);
  });
}

/** All the text of an element's <t> runs — one plain string, or rich text in pieces. */
function runsText(xml: string): string {
  let s = "";
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) s += decodeXml(m[1]);
  return s;
}

export function sharedStrings(xml: string | null | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => runsText(m[1]));
}

/** "D" → 3, "AA" → 26. */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export type Cell = string | number | null;

/** A worksheet's rows of values, each cell in its own column (gaps are null). */
export function sheetRows(sheetXml: string, shared: string[]): Cell[][] {
  const rows: Cell[][] = [];
  for (const row of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
    const cells: Cell[] = [];
    for (const c of (row[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const body = c[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="(\w+)"/.exec(attrs)?.[1] ?? "n";
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value: Cell = null;
      if (type === "s") value = raw === undefined ? null : shared[Number(raw)] ?? null;
      else if (type === "inlineStr") value = runsText(body);
      else if (type === "str" || type === "e") value = raw === undefined ? null : decodeXml(raw);
      else if (type === "b") value = raw === undefined ? null : Number(raw);
      else value = raw === undefined || raw === "" ? null : Number(raw);
      const at = ref ? columnIndex(ref) : cells.length;
      while (cells.length < at) cells.push(null);
      cells[at] = value;
    }
    rows.push(cells);
  }
  return rows;
}

/** The first worksheet of an .xlsx file, as rows of values. */
export async function readFirstSheet(bytes: Uint8Array): Promise<Cell[][]> {
  const files = await unzipText(bytes, (n) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const sheets = [...files.keys()].filter((n) => n.startsWith("xl/worksheets/"))
    .sort((a, b) => Number(/\d+/.exec(a.slice(14))?.[0]) - Number(/\d+/.exec(b.slice(14))?.[0]));
  if (sheets.length === 0) throw new Error("no worksheet");
  return sheetRows(files.get(sheets[0])!, sharedStrings(files.get("xl/sharedStrings.xml")));
}
