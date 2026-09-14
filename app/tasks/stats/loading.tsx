export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-28 bg-gray-200 rounded-lg" />
          <div className="h-4 w-72 bg-gray-100 rounded" />
        </div>
        <div className="h-16 w-28 bg-gray-200 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-white border border-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-white border border-gray-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
