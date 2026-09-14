export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-36 bg-gray-200 rounded-lg" />
        <div className="h-4 w-64 bg-gray-100 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-white border border-gray-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
