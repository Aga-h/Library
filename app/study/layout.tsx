import StudySidebar from "@/components/study/StudySidebar";

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <StudySidebar />
      <main className="flex-1 min-w-0 p-8">{children}</main>
    </div>
  );
}
