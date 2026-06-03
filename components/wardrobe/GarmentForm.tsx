"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ui/ImageUpload";

interface FormData {
  name: string; type: string; brand: string; color: string; colorGroup: string;
  materials: string; washMethod: string; maxTemp: string; washCycle: string;
  spinLevel: string; dryMethod: string; image: string; notes: string;
}

const DEFAULT: FormData = {
  name: "", type: "OTHER", brand: "", color: "", colorGroup: "MIXED",
  materials: "", washMethod: "MACHINE", maxTemp: "W40", washCycle: "NORMAL",
  spinLevel: "NORMAL", dryMethod: "TUMBLE_LOW", image: "", notes: "",
};

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-400";

interface Props { initialData?: Partial<FormData & { id: string }>; mode: "create" | "edit"; }

export default function GarmentForm({ initialData, mode }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...DEFAULT, ...initialData });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: keyof FormData, value: string) { setForm((p) => ({ ...p, [key]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    const payload = {
      name: form.name, type: form.type, brand: form.brand || undefined,
      color: form.color || undefined, colorGroup: form.colorGroup,
      materials: form.materials, washMethod: form.washMethod,
      maxTemp: form.maxTemp, washCycle: form.washCycle, spinLevel: form.spinLevel,
      dryMethod: form.dryMethod, image: form.image || undefined,
      notes: form.notes || undefined,
    };
    const url = mode === "edit" && initialData?.id ? `/api/wardrobe/${initialData.id}` : "/api/wardrobe";
    const res = await fetch(url, { method: mode === "edit" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Something went wrong"); setLoading(false); return; }
    const item = await res.json();
    router.push(`/wardrobe/${item.id}`);
  }

  const showTemp = form.washMethod === "MACHINE";
  const showSpin = form.washMethod === "MACHINE";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {/* Basic info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name *"><input type="text" required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Blue denim jeans" className={inputCls} /></Field>
        <Field label="Brand"><input type="text" value={form.brand} onChange={(e) => update("brand", e.target.value)} placeholder="e.g. Levi's" className={inputCls} /></Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Type">
          <select value={form.type} onChange={(e) => update("type", e.target.value)} className={inputCls}>
            <option value="TOPS">Tops</option>
            <option value="BOTTOMS">Bottoms</option>
            <option value="OUTERWEAR">Outerwear</option>
            <option value="UNDERWEAR">Underwear</option>
            <option value="SOCKS">Socks</option>
            <option value="ACTIVEWEAR">Activewear</option>
            <option value="FORMALWEAR">Formalwear</option>
            <option value="ACCESSORIES">Accessories</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Colour">
          <input type="text" value={form.color} onChange={(e) => update("color", e.target.value)} placeholder="e.g. Navy blue" className={inputCls} />
        </Field>
        <Field label="Colour Group (for washing)">
          <select value={form.colorGroup} onChange={(e) => update("colorGroup", e.target.value)} className={inputCls}>
            <option value="WHITE">White</option>
            <option value="LIGHT">Light colours</option>
            <option value="DARK">Dark colours</option>
            <option value="VIVID">Vivid / bright colours</option>
            <option value="MIXED">Mixed / unsure</option>
          </select>
        </Field>
      </div>

      {/* Materials */}
      <Field label="Materials / Fabric composition *">
        <input type="text" required value={form.materials} onChange={(e) => update("materials", e.target.value)} placeholder="e.g. 80% cotton, 20% polyester" className={inputCls} />
        <p className="text-xs text-gray-400 mt-1">Enter as it appears on the care label. Include percentages if available.</p>
      </Field>

      {/* Wash instructions */}
      <div className="border border-gray-100 rounded-xl p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Care Label — Washing</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Wash method">
            <select value={form.washMethod} onChange={(e) => update("washMethod", e.target.value)} className={inputCls}>
              <option value="MACHINE">Machine wash</option>
              <option value="HAND">Hand wash only</option>
              <option value="DRY_CLEAN">Dry clean only</option>
              <option value="DO_NOT_WASH">Do not wash</option>
            </select>
          </Field>
          {showTemp && (
            <Field label="Max temperature">
              <select value={form.maxTemp} onChange={(e) => update("maxTemp", e.target.value)} className={inputCls}>
                <option value="COLD">Cold (20°C)</option>
                <option value="W30">30°C</option>
                <option value="W40">40°C</option>
                <option value="W60">60°C</option>
                <option value="W90">90°C</option>
              </select>
            </Field>
          )}
          {showSpin && (
            <Field label="Wash cycle">
              <select value={form.washCycle} onChange={(e) => update("washCycle", e.target.value)} className={inputCls}>
                <option value="NORMAL">Normal</option>
                <option value="GENTLE">Gentle / Delicate</option>
              </select>
            </Field>
          )}
        </div>
        {showSpin && (
          <Field label="Spin intensity">
            <select value={form.spinLevel} onChange={(e) => update("spinLevel", e.target.value)} className={inputCls}>
              <option value="NORMAL">Normal spin</option>
              <option value="REDUCED">Reduced spin</option>
              <option value="NONE">No spin</option>
            </select>
          </Field>
        )}
      </div>

      {/* Dry instructions */}
      <div className="border border-gray-100 rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">Care Label — Drying</p>
        <Field label="Dry method">
          <select value={form.dryMethod} onChange={(e) => update("dryMethod", e.target.value)} className={inputCls}>
            <option value="TUMBLE_HIGH">Tumble dry — high heat</option>
            <option value="TUMBLE_MEDIUM">Tumble dry — medium heat</option>
            <option value="TUMBLE_LOW">Tumble dry — low heat</option>
            <option value="AIR_LINE">Air dry — hang on line / rack</option>
            <option value="AIR_FLAT">Air dry — lay flat</option>
            <option value="AIR_DRIP">Air dry — drip dry (no wringing)</option>
            <option value="DRY_CLEAN">Dry clean only</option>
            <option value="DO_NOT_DRY">Do not tumble dry</option>
          </select>
        </Field>
      </div>

      {/* Optional */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Photo URL (optional)">
          <input type="url" value={form.image} onChange={(e) => update("image", e.target.value)} placeholder="https://..." className={inputCls} />
        </Field>
        <Field label="Notes (optional)">
          <input type="text" value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Any extra care notes" className={inputCls} />
        </Field>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {loading ? (mode === "edit" ? "Saving…" : "Adding…") : (mode === "edit" ? "Save Changes" : "Add to Wardrobe")}
        </button>
        <button type="button" onClick={() => router.back()} className="border border-gray-200 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-gray-700">{label}</label>{children}</div>;
}
