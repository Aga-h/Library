import Sidebar from "@/components/layout/Sidebar";

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar />
      {/* Beside the sidebar (lg up) anything too wide scrolls inside main, so the sidebar never
          goes sideways with it; on a phone the page itself scrolls. */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 lg:overflow-auto">{children}</main>
    </div>
  );
}
