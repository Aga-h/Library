import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-gray-900 text-white p-3 rounded-xl mb-4">
        <Compass className="w-6 h-6" />
      </div>
      <h1 className="text-xl font-bold text-gray-900">Page not found</h1>
      <p className="text-sm text-gray-500 mt-1">
        That page does not exist, or the item was deleted.
      </p>
      <Link
        href="/"
        className="mt-5 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
      >
        Back to Portal
      </Link>
    </div>
  );
}
