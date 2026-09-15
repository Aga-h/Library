"use client";

import { useEffect } from "react";

/** Registers the service worker that makes the expense screen work offline. */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Registering after load keeps it off the critical path.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Not fatal — the app just loses offline support. */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
