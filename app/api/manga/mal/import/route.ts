import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";
import { MalError } from "@/lib/mal-service";
import { importManga } from "@/lib/mal-manga-import";

const schema = z.object({
  malId: z.number().int().positive(),
  /** Mark a finished series fully read. */
  read: z.boolean().default(false),
  /** Store the English title where MyAnimeList has one. */
  english: z.boolean().default(true),
  /** The language you read it in — reading time depends on it. */
  language: z.enum(LANGUAGE_VALUES).default("JAPANESE"),
  /** Link this manga, already in the library, to the entry instead. */
  mangaId: z.string().min(1).optional(),
});

/** Import one MyAnimeList manga, or link one you added by hand. Never adds the same one twice. */
async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const { malId, ...options } = result.data;
  try {
    const imported = await importManga(malId, options);
    if (imported.outcome !== "already") revalidateTag("library-stats", "max");
    return NextResponse.json(imported, { status: imported.outcome === "added" ? 201 : 200 });
  } catch (e) {
    if (e instanceof MalError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
