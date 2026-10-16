interface FooterStat {
  icon: React.ReactNode;
  label: string;
  value: string;
}

interface Props {
  heading: string;
  stats: { label: string; value: string | number }[];
  /** Tailwind classes for the stat tiles, e.g. "border-yellow-200 bg-yellow-50 text-yellow-700". */
  accentClass?: string;
  footer?: FooterStat[];
}

export default function LevelStats({
  heading,
  stats,
  accentClass = "border-yellow-200 bg-yellow-50 text-yellow-700",
  footer,
}: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{heading}</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`flex flex-col items-center justify-center min-w-0 rounded-lg border p-3 ${accentClass}`}
          >
            {/* Half a phone is ~140px: big counts step down a size there, and wrap rather than
                push the tile wider than its column. text-2xl stays on at every width — the looks
                hook their figure styles on `.text-2xl.font-bold` — and max-sm: only sizes it. */}
            <span className="text-2xl max-sm:text-xl font-bold max-w-full text-center [overflow-wrap:anywhere]">{s.value}</span>
            <span className="text-xs font-medium mt-0.5 text-center max-w-full break-words">{s.label}</span>
          </div>
        ))}
      </div>

      {footer && footer.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4 border-t border-gray-100">
          {footer.map((f) => (
            <div key={f.label} className="flex items-start gap-3">
              <div className="mt-0.5 text-gray-400 shrink-0">{f.icon}</div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium break-words">{f.label}</p>
                <p className="text-lg font-bold text-gray-800 break-words">{f.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
