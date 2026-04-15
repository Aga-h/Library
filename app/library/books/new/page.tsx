import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import BookForm from "@/components/books/BookForm";

export default function NewBookPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/library/books"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Books
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Add a New Book</h1>
        <BookForm mode="create" />
      </div>
    </div>
  );
}
