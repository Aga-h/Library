"use client";

import { HeartPulse, Salad, Shirt } from "lucide-react";
import SectionNav, { type NavItem } from "@/components/layout/SectionNav";

const NAV_ITEMS: NavItem[] = [
  { href: "/self-care", label: "Diet", icon: Salad, exact: true },
  { href: "/self-care/wardrobe", label: "Wardrobe", icon: Shirt },
];

export default function SelfCareSidebar() {
  return <SectionNav brand="Self Care" icon={HeartPulse} groups={[{ items: NAV_ITEMS }]} />;
}
