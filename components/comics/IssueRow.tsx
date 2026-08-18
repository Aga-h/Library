"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Package, Repeat } from "lucide-react";
import { formatIssueNumber } from "@/lib/comics";

interface Issue {
  id: string;
  issueNumber: number;
  name: string | null;
  read: boolean;
  owned: boolean;
  coverImage: string | null;
  rating: number | null;
  timesReread: number;
}

export default function IssueRow({ issue, href }: { issue: Issue; href: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  async function toggle(field: "read" | "owned") {
    setSaving(true);
    try {
      await fetch(`/api/comics/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !issue[field] }),
      });
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || isPending;

  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
      <div className="relative flex-shrink-0 w-9 h-12 rounded bg-gray-100 overflow-hidden flex items-center justify-center">
        {issue.coverImage ? (
          <Image fill src={issue.coverImage} alt={`Issue ${issue.issueNumber}`} className="object-cover" sizes="36px" />
        ) : (
          <BookOpen className="w-4 h-4 text-gray-300" />
        )}
      </div>

      <Link href={href} className="flex-1 min-w-0 group">
        <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-600 transition-colors">
          {formatIssueNumber(issue.issueNumber)}
        </p>
        {issue.name && <p className="text-xs text-gray-500 truncate">{issue.name}</p>}
      </Link>

      {issue.timesReread > 0 && (
        <span
          title={`Reread ${issue.timesReread}×`}
          className="flex items-center gap-0.5 text-xs font-semibold text-gray-400 flex-shrink-0"
        >
          <Repeat className="w-3 h-3" />{issue.timesReread}
        </span>
      )}

      {issue.rating != null && (
        <span className="text-xs font-semibold text-amber-500 flex-shrink-0">★ {issue.rating}</span>
      )}

      <button
        onClick={() => toggle("owned")}
        disabled={busy}
        title={issue.owned ? "Owned — click to unmark" : "Not owned — click to mark owned"}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border transition-colors disabled:opacity-50 flex-shrink-0 ${
          issue.owned
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "border-gray-200 text-gray-400 hover:bg-gray-50"
        }`}
      >
        <Package className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => toggle("read")}
        disabled={busy}
        title={issue.read ? "Read — click to unmark" : "Unread — click to mark read"}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors disabled:opacity-50 flex-shrink-0 ${
          issue.read
            ? "bg-green-50 text-green-700 border-green-200"
            : "border-gray-200 text-gray-400 hover:bg-gray-50"
        }`}
      >
        <Check className="w-3.5 h-3.5" />
        {issue.read ? "Read" : "Unread"}
      </button>
    </div>
  );
}
