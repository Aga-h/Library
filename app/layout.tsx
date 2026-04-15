import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyPortal",
  description: "Personal hub for all your apps and trackers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
