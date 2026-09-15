import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyPortal — Expenses",
    short_name: "Expenses",
    description: "Log an expense in a couple of taps.",
    // Opens straight to the logging screen rather than the portal home.
    start_url: "/finances/log",
    // Scope stays at the root so the rest of the app opens in-app instead of
    // bouncing out to Safari.
    scope: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#111827",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
