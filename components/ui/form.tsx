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

/**
 * A `<select>` over a numeric range, wrapped in `Field`.
 *
 * The same hand-rolled `Array.from({length}, …)` select is copy-pasted into six forms for
 * "times rewatched"; this exists so the season selector does not become the seventh. State is
 * a string, like every other field in these forms, and is parsed on submit.
 */
export function NumberSelectField({
  label, value, onChange, min = 1, max, emptyLabel, format = String,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max: number;
  /** Shown for the empty option. Omit to make a choice mandatory. */
  emptyLabel?: string;
  format?: (n: number) => string;
}) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  // An out-of-range stored value must still be selectable, or opening an old entry and saving
  // would silently snap it to something else.
  const current = Number(value);
  const extra = value !== "" && Number.isFinite(current) && !options.includes(current) ? current : null;

  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {extra !== null && <option value={String(extra)}>{format(extra)}</option>}
        {options.map((n) => (
          <option key={n} value={String(n)}>{format(n)}</option>
        ))}
      </select>
    </Field>
  );
}
