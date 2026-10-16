"use client";

import { BookA, ClipboardList, GalleryHorizontalEnd, GraduationCap, Layers, ListChecks, Timer, TrendingUp, Zap } from "lucide-react";
import SectionNav, { type NavGroup } from "@/components/layout/SectionNav";

const GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/study", label: "Study", icon: Timer, exact: true },
      { href: "/study/modules", label: "Modules", icon: Layers },
      { href: "/study/review", label: "Review", icon: ClipboardList },
      { href: "/study/stats", label: "Stats", icon: TrendingUp },
      { href: "/study/ap", label: "APs", icon: GraduationCap },
    ],
  },
  {
    label: "Vocabulary",
    items: [
      { href: "/study/sat-vocab", label: "SAT Vocabulary", icon: BookA, exact: true },
      { href: "/study/sat-vocab/flashcards", label: "Flashcards", icon: GalleryHorizontalEnd },
      { href: "/study/sat-vocab/quick", label: "Quick test", icon: Zap },
      { href: "/study/sat-vocab/words", label: "Word list", icon: ListChecks },
    ],
  },
];

export default function StudySidebar() {
  return <SectionNav brand="Study" icon={GraduationCap} groups={GROUPS} />;
}
