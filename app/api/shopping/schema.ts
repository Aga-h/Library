import { z } from "zod";
import { CATEGORY_MAX, NAME_MAX, NOTE_MAX, PRODUCT_NAME_MAX, cleanCategory, normaliseShopUrl } from "@/lib/shopping";

/** An address as typed, made a full https URL; anything that is not a web page is refused. */
const url = z.string().transform((v, ctx) => {
  const href = normaliseShopUrl(v);
  if (!href) {
    ctx.addIssue({ code: "custom", message: "That doesn't look like a web address" });
    return z.NEVER;
  }
  return href;
});

// Notes are optional. An empty one is stored as nothing, so clearing the field on edit clears it;
// one not sent at all stays undefined, so an edit that doesn't mention it leaves it alone.
const note = z
  .string()
  .max(NOTE_MAX)
  .nullish()
  .transform((v) => (v === undefined ? undefined : v && v.trim() ? v.trim() : null));

export const createShopSchema = z.object({
  name: z.string().trim().min(1, "Give the shop a name").max(NAME_MAX),
  url,
  category: z.string().transform(cleanCategory).pipe(z.string().min(1, "Pick a category").max(CATEGORY_MAX)),
  liked: note,
  disliked: note,
});

export const updateShopSchema = createShopSchema.partial();

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Give the product a name").max(PRODUCT_NAME_MAX),
  comment: note,
});

export const updateProductSchema = createProductSchema.partial();

/** The first problem with a request body, worded for the form. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Validation failed";
}
