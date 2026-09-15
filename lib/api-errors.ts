import { NextResponse } from "next/server";

/**
 * Guarantees a JSON body on every response path.
 *
 * Route handlers had no try/catch around Prisma, so a database outage produced a bare 500 with
 * a non-JSON body. Every client component then called res.json() on the failure branch and
 * threw SyntaxError inside an un-caught handler, leaving submit buttons stuck on "Saving…".
 */
export function withErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (e) {
      // Detail stays server-side; the client gets a stable, non-leaking message.
      console.error("[api]", e);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

/** Parse a JSON body, returning null instead of throwing on malformed input. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
