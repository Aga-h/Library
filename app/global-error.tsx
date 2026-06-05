"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen text-center p-8">
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-4">{error.message}</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
