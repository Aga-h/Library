export default function GridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-[2/3] bg-gray-200 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}
