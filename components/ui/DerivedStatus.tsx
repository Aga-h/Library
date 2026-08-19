/**
 * Shows what the status will be once saved. Status is computed from the progress counts, so
 * without this the form would silently decide something the user can't see.
 *
 * Matches the existing live-hint convention used for the reading-time previews.
 */
export default function DerivedStatus({ label }: { label: string }) {
  return (
    <p className="text-xs text-gray-400 mt-1.5">
      Status: <strong className="text-gray-600">{label}</strong>{" "}
      <span className="text-gray-300">· set automatically</span>
    </p>
  );
}
