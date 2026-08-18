"use client";

export default function FinancesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-lg font-semibold text-gray-900">Could not load your finances</p>
      <p className="text-sm text-gray-500 mt-1 max-w-sm">
        Something went wrong fetching this month. Try again in a moment.
      </p>
      {error.digest && <p className="text-xs text-gray-400 mt-2">Reference: {error.digest}</p>}
      <button
        onClick={reset}
        className="mt-5 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
