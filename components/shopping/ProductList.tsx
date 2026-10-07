"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Field, inputCls } from "@/components/ui/form";
import { NOTE_MAX, PRODUCT_NAME_MAX } from "@/lib/shopping";

export interface Product {
  id: string;
  name: string;
  comment: string | null;
}

/** A shop's products, each with what you thought of it: add, change and remove them in place. */
export default function ProductList({ shopId, products }: { shopId: string; products: Product[] }) {
  return (
    <div className="space-y-6">
      {products.length === 0 ? (
        <p className="text-sm text-gray-400">No products yet — add the first thing you bought here below.</p>
      ) : (
        <ol className="shop-product-list divide-y divide-gray-100">
          {products.map((p) => <ProductRow key={p.id} shopId={shopId} product={p} />)}
        </ol>
      )}
      <AddProduct shopId={shopId} />
    </div>
  );
}

function AddProduct({ shopId }: { shopId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/shopping/${shopId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, comment }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setName("");
    setComment("");
    router.refresh();
  }

  return (
    <form id="add-product" onSubmit={add} className="shop-product-form space-y-3 scroll-mt-24">
      <p className="text-sm font-semibold text-gray-700">Add a product</p>
      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      <Field label="Product *">
        <input type="text" required maxLength={PRODUCT_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Heattech crew neck" className={inputCls} />
      </Field>
      <Field label="What I thought of it">
        <textarea rows={3} maxLength={NOTE_MAX} value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder="Warm, but it pilled after a month…" className={inputCls} />
      </Field>
      <div className="flex justify-end">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          <Plus className="w-4 h-4" /> {saving ? "Adding…" : "Add product"}
        </button>
      </div>
    </form>
  );
}

function ProductRow({ shopId, product }: { shopId: string; product: Product }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(product.name);
  const [comment, setComment] = useState(product.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/shopping/${shopId}/products/${product.id}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // The comment is always sent, so clearing it clears it.
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, comment }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(url, { method: "DELETE" });
    setBusy(false);
    setConfirming(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  if (editing) {
    return (
      <li className="shop-product py-4">
        <form onSubmit={save} className="space-y-3">
          {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <Field label="Product *">
            <input type="text" required maxLength={PRODUCT_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="What I thought of it">
            <textarea rows={3} maxLength={NOTE_MAX} value={comment} onChange={(e) => setComment(e.target.value)} className={inputCls} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setName(product.name); setComment(product.comment ?? ""); setError(null); }}
              className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={busy}
              className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="shop-product py-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="shop-product-name font-semibold text-gray-900 break-words">{product.name}</p>
        {product.comment
          ? <p className="shop-product-comment text-sm text-gray-600 mt-1 whitespace-pre-line break-words">{product.comment}</p>
          : <p className="text-xs text-gray-400 mt-1">No comment yet.</p>}
        {error && <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      {confirming ? (
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={remove} disabled={busy}
            className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
            {busy ? "Deleting…" : "Delete"}
          </button>
          <button onClick={() => setConfirming(false)}
            className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors">
            Keep
          </button>
        </div>
      ) : (
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => setEditing(true)} aria-label={`Edit ${product.name}`}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => setConfirming(true)} aria-label={`Delete ${product.name}`}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </li>
  );
}
