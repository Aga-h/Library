import { Thermometer, Wind, Droplets, Info, CheckCircle, XCircle } from "lucide-react";
import type { WashRecommendation } from "@/lib/wash-calculator";

const HEAT_LABELS = { low: "Low heat (60°C)", medium: "Medium heat (80°C)", high: "High heat (full)" };
const SPIN_LABEL = (rpm: number) =>
  rpm === 0 ? "No spin" : rpm <= 400 ? `${rpm} rpm — very gentle` : rpm <= 600 ? `${rpm} rpm — gentle` : rpm <= 1000 ? `${rpm} rpm — medium` : `${rpm} rpm — high`;

export default function WashRecommendationCard({ rec }: { rec: WashRecommendation }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Wash Recommendation</h2>
      </div>

      {/* Machine settings */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-gray-100 border-b border-gray-100">
        <Cell icon={<Thermometer className="w-4 h-4" />} label="Temperature">
          <span className="text-2xl font-bold text-gray-900">{rec.temperature}°C</span>
        </Cell>
        <Cell icon={<Wind className="w-4 h-4" />} label="Spin Speed">
          <span className="text-sm font-bold text-gray-900">{SPIN_LABEL(rec.spinRPM)}</span>
        </Cell>
        <Cell icon={<Info className="w-4 h-4" />} label="Cycle">
          <span className="text-sm font-bold text-gray-900">{rec.cycle}</span>
        </Cell>
        <Cell icon={<Droplets className="w-4 h-4" />} label="Detergent">
          <span className="text-sm font-bold text-gray-900 text-center">{rec.detergent}</span>
        </Cell>
      </div>

      {/* Dryer */}
      <div className="px-6 py-5 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Dryer</p>
        {rec.dryer.recommended ? (
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800 text-sm">Tumble dry — {HEAT_LABELS[rec.dryer.heat!]}</p>
              {rec.dryer.estimatedMinutes && (
                <p className="text-xs text-gray-400 mt-0.5">Estimated {rec.dryer.estimatedMinutes} minutes</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800 text-sm">Do not tumble dry</p>
              {rec.dryer.alternative && (
                <p className="text-xs text-gray-500 mt-0.5">{rec.dryer.alternative}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pre-soak */}
      {rec.preSoak && (
        <div className="px-6 py-4 border-b border-gray-100 bg-amber-50">
          <p className="text-sm text-amber-700 font-medium">Pre-soak recommended — submerge in cool water for 30 min before washing</p>
        </div>
      )}

      {/* Notes */}
      {rec.notes.length > 0 && (
        <div className="px-6 py-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tips</p>
          <ul className="space-y-2">
            {rec.notes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-gray-300 mt-0.5">•</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Cell({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 p-5 text-center">
      <div className="text-gray-400">{icon}</div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      {children}
    </div>
  );
}
