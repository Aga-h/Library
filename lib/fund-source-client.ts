// The card you last paid with, remembered on this device, so the next expense starts there.
// Browser-only; read through useSyncExternalStore so the month page and the quick log agree.

import { useSyncExternalStore } from "react";
import { isFundSource, type FundSource } from "@/lib/fund-sources";

const KEY = "finance-source";
const EVENT = "finance-source-change";

function read(): FundSource {
  try {
    const v = localStorage.getItem(KEY);
    return isFundSource(v) ? v : "BASE";
  } catch {
    return "BASE"; // storage blocked (private mode): Base, as before sources existed
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useStoredSource(): [FundSource, (s: FundSource) => void] {
  const source = useSyncExternalStore(subscribe, read, () => "BASE" as FundSource);
  const set = (s: FundSource) => {
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* not remembered, but still used for this expense */
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return [source, set];
}
