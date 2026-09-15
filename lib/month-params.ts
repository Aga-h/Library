import { z } from "zod";

const monthParamsSchema = z.object({
  year: z.coerce.number().int().min(1970).max(2200),
  month: z.coerce.number().int().min(1).max(12),
});

export type MonthParams = z.infer<typeof monthParamsSchema>;

/**
 * Parse `[year]/[month]` route params. Returns null when they are not a real calendar month.
 * Unvalidated values previously reached Prisma as NaN (an uncaught 500) and, worse, a POST to
 * /api/finances/2026/77 persisted month 77, permanently skewing every later carryover.
 */
export function parseMonthParams(raw: { year: string; month: string }): MonthParams | null {
  const result = monthParamsSchema.safeParse(raw);
  return result.success ? result.data : null;
}
