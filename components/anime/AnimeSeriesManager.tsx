"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Layers, Tv2, Check, X } from "lucide-react";
import { inputCls } from "@/components/ui/form";

interface Series { id: string; name: string; }
interface Item { id: string; title: string; coverImage: string | null; seriesName: string | null; }


export default function AnimeSeriesManager({ allItems }: { allItems: Item[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<"add" | "assign" | null>(null);

  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  const [series, setSeries] = useState<Series[]>([]);
  const [activeSeries, setActiveSeries] = useState<Series | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  function close() {
    setModal(null);
    setNewName(""); setAddError(null);
    setActiveSeries(null); setSelected(new Set()); setAssignError(null);
  }

  async function openAssign() {
    setOpen(false);
    const res = await fetch("/api/anime-series");
    setSeries(await res.json());
    setModal("assign");
  }

  function openAdd() { setOpen(false); setModal("add"); }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true); setAddError(null);
    const res = await fetch("/api/anime-series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setAddLoading(false);
    if (!res.ok) { setAddError((await res.json()).error ?? "Failed"); return; }
    close();
  }

  function pickSeries(s: Series) {
    setActiveSeries(s);
    setSelected(new Set(allItems.filter(i => i.seriesName === s.name).map(i => i.id)));
  }

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n; });
  }

  async function submitAssign() {
    if (!activeSeries) return;
    setAssignLoading(true);
    setAssignError(null);
    // allSettled, not all: one rejection used to orphan the remaining in-flight PATCHes as
    // unhandled rejections and leave the modal stuck open. And since fetch only rejects on
    // network failure, HTTP errors must be counted explicitly, or a half-failed batch
    // reported success and refreshed to stale data.
    const results = await Promise.allSettled(
      allItems
        .filter((item) => {
          const shouldBe = selected.has(item.id);
          const isNow = item.seriesName === activeSeries.name;
          return shouldBe !== isNow;
        })
        .map((item) =>
          fetch(`/api/anime/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seriesName: selected.has(item.id) ? activeSeries.name : null }),
          }).then((res) => {
            if (!res.ok) throw new Error(String(res.status));
            return res;
          })
        )
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setAssignLoading(false);
    router.refresh();
    if (failed > 0) {
      setAssignError(`${failed} item${failed === 1 ? "" : "s"} could not be updated.`);
      return;
    }
    close();
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen(p => !p)}
          className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          <Layers className="w-4 h-4" />
          Series
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-44">
              <button onClick={openAdd} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                <Plus className="w-3.5 h-3.5 flex-shrink-0" /> Add Series
              </button>
              <button onClick={openAssign} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                <Layers className="w-3.5 h-3.5 flex-shrink-0" /> Add to Series
              </button>
            </div>
          </>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={close}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-semibold text-gray-900">{modal === "add" ? "Add Series" : "Add to Series"}</h2>
              <button onClick={close} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            {modal === "add" ? (
              <form onSubmit={submitAdd} className="flex flex-col gap-4 p-6">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Series name</label>
                  <input
                    autoFocus
                    type="text"
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Attack on Titan"
                    className={inputCls}
                  />
                  {addError && <p className="text-red-600 text-xs mt-1.5">{addError}</p>}
                </div>
                <button
                  type="submit"
                  disabled={addLoading || !newName.trim()}
                  className="bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {addLoading ? "Creating…" : "Create Series"}
                </button>
              </form>
            ) : (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Select a series</p>
                  {series.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No series yet — create one first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {series.map(s => (
                        <button
                          key={s.id}
                          onClick={() => pickSeries(s)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                            activeSeries?.id === s.id
                              ? "bg-gray-900 text-white border-gray-900"
                              : "border-gray-200 text-gray-700 hover:border-gray-400"
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {activeSeries && (
                  <>
                    <div className="px-6 pt-3 pb-2 flex-shrink-0">
                      <p className="text-xs text-gray-500">
                        Click items to add/remove them from <strong className="text-gray-700">{activeSeries.name}</strong>
                      </p>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 pb-4">
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {allItems.map(item => {
                          const isSelected = selected.has(item.id);
                          return (
                            <button
                              key={item.id}
                              onClick={() => toggle(item.id)}
                              className={`relative rounded-lg overflow-hidden aspect-[2/3] border-2 transition-all ${
                                isSelected ? "border-blue-500 shadow-sm" : "border-transparent"
                              }`}
                            >
                              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                {item.coverImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover" />
                                ) : (
                                  <Tv2 className="w-8 h-8 text-gray-300" />
                                )}
                              </div>
                              {isSelected && (
                                <div className="absolute inset-0 bg-blue-500/20">
                                  <div className="absolute top-1.5 right-1.5 bg-blue-500 rounded-full p-0.5">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                </div>
                              )}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1.5 pt-4">
                                <p className="text-white text-xs line-clamp-2 leading-tight">{item.title}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
                      {assignError && <p className="text-red-600 text-xs mb-2">{assignError}</p>}
                      <button
                        onClick={submitAssign}
                        disabled={assignLoading}
                        className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        {assignLoading ? "Saving…" : `Confirm — ${selected.size} season${selected.size !== 1 ? "s" : ""} selected`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
