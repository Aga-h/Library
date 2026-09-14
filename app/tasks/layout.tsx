import TasksSidebar from "@/components/tasks/TasksSidebar";

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <TasksSidebar />
      <main className="flex-1 min-w-0 p-8">{children}</main>
    </div>
  );
}
