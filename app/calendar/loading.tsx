export default function CalendarLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded mx-auto mb-6" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 42 }, (_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
