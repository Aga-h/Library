import StudySidebar from "@/components/study/StudySidebar";

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <StudySidebar />
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
