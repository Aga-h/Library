export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded" />
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="h-7 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-32 bg-gray-100 rounded" />
        <div className="h-4 w-64 bg-gray-100 rounded" />
        <div className="flex gap-3 pt-2">
          <div className="h-9 w-28 bg-gray-200 rounded-lg" />
          <div className="h-9 w-36 bg-gray-200 rounded-lg" />
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="h-14 bg-gray-50 border-b border-gray-100" />
        <div className="grid grid-cols-4 divide-x divide-gray-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 flex flex-col items-center gap-2">
              <div className="h-4 w-4 bg-gray-200 rounded-full" />
              <div className="h-3 w-16 bg-gray-100 rounded" />
              <div className="h-6 w-12 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
