// Structural check rather than an instanceof against Prisma's error class — the driver-adapter
// client re-exports those from a path that shifts between versions.
export function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/** The row to update or delete wasn't there (P2025) — someone deleted it first. */
export function isNotFound(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2025"
  );
}
