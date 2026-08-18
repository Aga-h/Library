/**
 * Narrow an untrusted query-string value to a known enum member.
 *
 * List pages previously did `status as BookStatus` straight from searchParams into Prisma, so
 * `?status=nonsense` threw inside the query and surfaced as an uncaught 500. On a page the
 * right behaviour is to ignore an unrecognised filter; API routes should return 400 instead.
 */
export function asEnum<const T extends readonly string[]>(
  value: string | null | undefined,
  allowed: T
): T[number] | undefined {
  return value != null && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : undefined;
}
