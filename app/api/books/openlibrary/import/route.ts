import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";
import { BookCatalogError, MAX_IMPORT } from "@/lib/openlibrary";
import { importWorks } from "@/lib/openlibrary-import";

export const maxDuration = 60;

const itemSchema = z.object({
  googleBooksId: z.string().regex(/^[A-Za-z0-9_-]{8,20}$/),
  title: z.string().trim().min(1).max(300).optional(),
});

const schema = z.object({
  items: z.array(itemSchema).min(1).max(MAX_IMPORT),
  read: z.boolean().default(false),
  owned: z.boolean().default(false),
  ownedKindle: z.boolean().default(false),
  language: z.enum(LANGUAGE_VALUES).default("ENGLISH"),
  seriesId: z.string().min(1).nullable().default(null),
  /** Link this book, already in the library, to the volume instead. */
  bookId: z.string().min(1).optional(),
  /** With bookId: switch it to this edition even if it was linked to another. */
  replace: z.boolean().default(false),
});

/** Import books from Google Books. Re-import only fills blanks. */
async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const { items, ...options } = result.data;
  try {
    const imported = await importWorks(
      items.map((item) => ({
        googleBooksId: item.googleBooksId,
        ...(item.title ? { title: item.title } : {}),
      })),
      options,
    );
    revalidateTag("library-stats", "max");
    const added = imported.report.some((line) => line.outcome === "added");
    return NextResponse.json(imported, { status: added ? 201 : 200 });
  } catch (e) {
    if (e instanceof BookCatalogError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
