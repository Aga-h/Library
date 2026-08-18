/**
 * Shared control styling. This string was copy-pasted into 14 files and had already drifted —
 * AnimeSeriesManager's copy was missing focus:border-transparent, so that one input's focus
 * ring looked different from every other one.
 */
export const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-400";

/**
 * Label wrapping its control, which associates the two implicitly.
 *
 * The per-file copies of this helper rendered a bare <label> with the control as a *sibling*
 * and no htmlFor, so nothing tied them together: screen readers announced every field as
 * unlabeled, and clicking a label did not focus its input.
 */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

/**
 * Same look, but a plain container rather than a <label>. Use where the control is not a single
 * focusable element — wrapping ImageUpload's preview and buttons in a label would make every
 * click inside it open the file picker.
 */
export function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </div>
  );
}
