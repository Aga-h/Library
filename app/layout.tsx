import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyPortal",
  description: "Personal hub for all your apps and trackers.",
  appleWebApp: {
    capable: true,
    title: "Expenses",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  // Lets the layout extend under the notch / home indicator when installed.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen bg-gray-50">
        {children}
        <ServiceWorkerRegistrar />
        <SpeedInsights />
      </body>
    </html>
  );
}
