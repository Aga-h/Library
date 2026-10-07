export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-gray-200 rounded-lg" />
          <div className="h-4 w-44 bg-gray-100 rounded" />
        </div>
        <div className="h-10 w-28 bg-gray-200 rounded-lg" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-7 w-20 bg-gray-200 rounded-full" />)}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-8 w-40 bg-gray-200 rounded-lg" />
          {Array.from({ length: 2 }).map((_, j) => <div key={j} className="ml-12 h-28 bg-gray-100 rounded-xl" />)}
        </div>
      ))}
    </div>
  );
}
