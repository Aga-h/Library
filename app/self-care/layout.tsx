import SelfCareSidebar from "@/components/self-care/SelfCareSidebar";

export default function SelfCareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50">
      <SelfCareSidebar />
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
