import type { Metadata } from "next";
import SelfCareSidebar from "@/components/self-care/SelfCareSidebar";

// Added to the home screen from here, Diet is its own app beside the expense logger: its own
// name, icon and start page. appleWebApp is replaced whole, not merged, so all of it is repeated.
export const metadata: Metadata = {
  manifest: "/diet.webmanifest",
  appleWebApp: { capable: true, title: "Diet", statusBarStyle: "default" },
  icons: { apple: "/icons/diet-apple-180.png" },
};

export default function SelfCareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50">
      <SelfCareSidebar />
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
