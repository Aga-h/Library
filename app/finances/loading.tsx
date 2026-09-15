export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-9 w-9 bg-gray-200 rounded-lg" />
        <div className="h-7 w-40 bg-gray-200 rounded-lg" />
        <div className="h-9 w-9 bg-gray-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
            <div className="h-3 w-20 bg-gray-100 rounded" />
            <div className="h-6 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 h-64" />
        ))}
      </div>
    </div>
  );
}
