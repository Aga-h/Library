export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-gray-200 rounded-lg" />
          <div className="h-4 w-32 bg-gray-100 rounded" />
        </div>
        <div className="h-10 w-48 bg-gray-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-white border border-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="h-[62vh] bg-white border border-gray-200 rounded-xl" />
    </div>
  );
}
