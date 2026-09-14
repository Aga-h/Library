// The fourteen stats a module can train.

import {
  Dumbbell, Wind, HeartPulse, Brain, Eye, Users, Flag, Compass, Anchor,
  Flame, Gem, Binary, AudioLines, Sparkles, type LucideIcon,
} from "lucide-react";

export const STATS = [
  "STRENGTH", "DEXTERITY", "CONSTITUTION", "INTELLIGENCE", "WISDOM",
  "CHARISMA", "RESOLVE", "INTUITION", "COMPOSURE", "WILLPOWER",
  "ESSENCE", "LOGIC", "RESONANCE", "MAGIC",
] as const;

export type Stat = (typeof STATS)[number];

export interface StatMeta {
  label: string;
  abbr: string;
  description: string;
  icon: LucideIcon;
  text: string;
  bg: string;
  border: string;
  bar: string;
}

export const STAT_META: Record<Stat, StatMeta> = {
  STRENGTH:     { label: "Strength",     abbr: "STR", description: "Raw physical force — lifting, pushing, hard training.",   icon: Dumbbell,   text: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200",    bar: "bg-rose-500" },
  DEXTERITY:    { label: "Dexterity",    abbr: "DEX", description: "Precision and coordination — hands, speed, technique.",   icon: Wind,       text: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200",  bar: "bg-orange-500" },
  CONSTITUTION: { label: "Constitution", abbr: "CON", description: "Endurance and health — stamina, recovery, conditioning.", icon: HeartPulse, text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   bar: "bg-amber-500" },
  INTELLIGENCE: { label: "Intelligence", abbr: "INT", description: "Knowledge and study — learning, analysis, memory.",       icon: Brain,      text: "text-sky-700",     bg: "bg-sky-50",     border: "border-sky-200",     bar: "bg-sky-500" },
  WISDOM:       { label: "Wisdom",       abbr: "WIS", description: "Judgement and perception — reflection, perspective.",     icon: Eye,        text: "text-teal-700",    bg: "bg-teal-50",    border: "border-teal-200",    bar: "bg-teal-500" },
  CHARISMA:     { label: "Charisma",     abbr: "CHA", description: "Presence and persuasion — social work, performance.",     icon: Users,      text: "text-pink-700",    bg: "bg-pink-50",    border: "border-pink-200",    bar: "bg-pink-500" },
  RESOLVE:      { label: "Resolve",      abbr: "RES", description: "Follow-through — finishing what was started.",            icon: Flag,       text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     bar: "bg-red-500" },
  INTUITION:    { label: "Intuition",    abbr: "ITU", description: "Reading the unspoken — instinct, pattern sense.",         icon: Compass,    text: "text-lime-700",    bg: "bg-lime-50",    border: "border-lime-200",    bar: "bg-lime-500" },
  COMPOSURE:    { label: "Composure",    abbr: "CMP", description: "Calm under pressure — steadiness, emotional control.",    icon: Anchor,     text: "text-cyan-700",    bg: "bg-cyan-50",    border: "border-cyan-200",    bar: "bg-cyan-500" },
  WILLPOWER:    { label: "Willpower",    abbr: "WIL", description: "Discipline against resistance — showing up anyway.",      icon: Flame,      text: "text-fuchsia-700", bg: "bg-fuchsia-50", border: "border-fuchsia-200", bar: "bg-fuchsia-500" },
  ESSENCE:      { label: "Essence",      abbr: "ESS", description: "Core self — identity, vitality, the thing underneath.",   icon: Gem,        text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500" },
  LOGIC:        { label: "Logic",        abbr: "LOG", description: "Formal reasoning — systems, proofs, code, structure.",    icon: Binary,     text: "text-indigo-700",  bg: "bg-indigo-50",  border: "border-indigo-200",  bar: "bg-indigo-500" },
  RESONANCE:    { label: "Resonance",    abbr: "RSN", description: "Attunement — music, empathy, being in sync.",             icon: AudioLines, text: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200",  bar: "bg-violet-500" },
  MAGIC:        { label: "Magic",        abbr: "MAG", description: "The strange and creative — imagination, craft, wonder.",  icon: Sparkles,   text: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200",  bar: "bg-purple-500" },
};

export const MAX_STATS_PER_MODULE = 3;
export const MIN_STATS_PER_MODULE = 1;

export function isStat(value: string): value is Stat {
  return (STATS as readonly string[]).includes(value);
}

// ─── Module colours ──────────────────────────────────────────────────────────

export const MODULE_COLORS = ["SLATE", "INDIGO", "VIOLET", "SKY", "EMERALD", "AMBER", "ROSE"] as const;

export type ModuleColor = (typeof MODULE_COLORS)[number];

export interface ModuleColorMeta {
  label: string;
  chip: string;   // small swatch
  block: string;  // calendar block
  soft: string;   // card accent
  text: string;
}

export const MODULE_COLOR_META: Record<ModuleColor, ModuleColorMeta> = {
  SLATE:   { label: "Slate",   chip: "bg-slate-500",   block: "bg-slate-100 border-slate-300 text-slate-800",       soft: "bg-slate-50 border-slate-200",     text: "text-slate-700" },
  INDIGO:  { label: "Indigo",  chip: "bg-indigo-500",  block: "bg-indigo-100 border-indigo-300 text-indigo-800",    soft: "bg-indigo-50 border-indigo-200",   text: "text-indigo-700" },
  VIOLET:  { label: "Violet",  chip: "bg-violet-500",  block: "bg-violet-100 border-violet-300 text-violet-800",    soft: "bg-violet-50 border-violet-200",   text: "text-violet-700" },
  SKY:     { label: "Sky",     chip: "bg-sky-500",     block: "bg-sky-100 border-sky-300 text-sky-800",             soft: "bg-sky-50 border-sky-200",         text: "text-sky-700" },
  EMERALD: { label: "Emerald", chip: "bg-emerald-500", block: "bg-emerald-100 border-emerald-300 text-emerald-800", soft: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  AMBER:   { label: "Amber",   chip: "bg-amber-500",   block: "bg-amber-100 border-amber-300 text-amber-800",       soft: "bg-amber-50 border-amber-200",     text: "text-amber-700" },
  ROSE:    { label: "Rose",    chip: "bg-rose-500",    block: "bg-rose-100 border-rose-300 text-rose-800",          soft: "bg-rose-50 border-rose-200",       text: "text-rose-700" },
};

export function isModuleColor(value: string): value is ModuleColor {
  return (MODULE_COLORS as readonly string[]).includes(value);
}
