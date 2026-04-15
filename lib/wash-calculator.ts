// Wash calculator — converts garment data into machine settings + dryer advice

export interface WashRecommendation {
  temperature: number;
  cycle: string;
  spinRPM: number;
  detergent: string;
  preSoak: boolean;
  dryer: {
    recommended: boolean;
    heat?: "low" | "medium" | "high";
    alternative?: string;
    estimatedMinutes?: number;
  };
  notes: string[];
  urgency: "fresh" | "can_wait" | "wash_soon" | "wash_now";
  urgencyLabel: string;
}

interface GarmentInput {
  materials: string;
  washMethod: string;
  maxTemp: string;
  washCycle: string;
  spinLevel: string;
  dryMethod: string;
  colorGroup: string;
  type: string;
  wornCount: number;
}

const TEMP_MAP: Record<string, number> = {
  COLD: 20, W30: 30, W40: 40, W60: 60, W90: 90,
};

function fabricMaxTemp(materials: string): number {
  const m = materials.toLowerCase();
  if (/\bsilk\b/.test(m)) return 30;
  if (/\bwool\b|\bcashmere\b|\bmerino\b|\bangora\b/.test(m)) return 30;
  if (/\bviscose\b|\brayon\b|\btencel\b|\blyocell\b|\bmodal\b/.test(m)) return 30;
  if (/\belastane\b|\bspandex\b|\blycra\b/.test(m)) return 40;
  if (/\bacrylic\b/.test(m)) return 40;
  if (/\bpolyester\b|\bnylon\b/.test(m)) return 40;
  if (/\blinen\b/.test(m)) return 60;
  if (/\bcotton\b/.test(m)) return 60;
  return 40;
}

type Sensitivity = "very_delicate" | "delicate" | "normal" | "sturdy";
function sensitivity(materials: string): Sensitivity {
  const m = materials.toLowerCase();
  if (/\bsilk\b|\bwool\b|\bcashmere\b|\bmerino\b|\bangora\b/.test(m)) return "very_delicate";
  if (/\bviscose\b|\brayon\b|\btencel\b|\blyocell\b|\bmodal\b|\blace\b|\belastane\b|\bspandex\b/.test(m)) return "delicate";
  if (/\bcotton\b|\blinen\b/.test(m)) return "sturdy";
  return "normal";
}

function fabricNotes(materials: string, colorGroup: string, type: string): string[] {
  const m = materials.toLowerCase();
  const notes: string[] = [];
  if (/\bsilk\b/.test(m)) notes.push("Use a silk-specific or delicate detergent");
  if (/\bwool\b|\bcashmere\b|\bmerino\b/.test(m)) {
    notes.push("Use wool detergent");
    notes.push("Do not wring — gently squeeze out excess water");
  }
  if (/\bviscose\b|\brayon\b|\btencel\b/.test(m)) notes.push("Handle gently when wet — these fibres weaken with water");
  if (/\belastane\b|\bspandex\b|\blycra\b/.test(m)) notes.push("Avoid fabric softener — it degrades elastic fibres over time");
  if (/\bdenim\b/.test(m)) notes.push("Wash inside out to slow colour fading");
  if (colorGroup === "DARK" || colorGroup === "VIVID") notes.push("Wash inside out to protect colour");
  if (colorGroup === "WHITE") notes.push("A whitening booster can be added if yellowing occurs");
  if (type === "ACTIVEWEAR") notes.push("Skip fabric softener — it clogs moisture-wicking fibres");
  return notes;
}

export function calculateWash(input: GarmentInput): WashRecommendation {
  const { materials, washMethod, maxTemp, washCycle, spinLevel, dryMethod, colorGroup, type, wornCount } = input;

  // ── Temperature ─────────────────────────────────────────────────────────────
  const careLimit = TEMP_MAP[maxTemp] ?? 40;
  const fabricLimit = fabricMaxTemp(materials);
  const hardMax = Math.min(careLimit, fabricLimit);

  let temp: number;
  if (wornCount <= 1) temp = Math.min(hardMax, 30);
  else if (wornCount <= 3) temp = Math.min(hardMax, 40);
  else temp = hardMax;
  // Whites with 3+ wears — push toward 60 for hygiene
  if (colorGroup === "WHITE" && wornCount >= 3) temp = Math.min(hardMax, 60);

  // ── Cycle ────────────────────────────────────────────────────────────────────
  const sens = sensitivity(materials);
  let cycle: string;
  if (washMethod === "HAND") {
    cycle = "Wool / Hand Wash";
  } else if (sens === "very_delicate" || washCycle === "GENTLE") {
    cycle = "Delicate / Gentle";
  } else if (/\bpolyester\b|\bnylon\b|\bacrylic\b/.test(materials.toLowerCase())) {
    cycle = "Synthetic / Easy Care";
  } else if (/\bcotton\b|\blinen\b/.test(materials.toLowerCase())) {
    cycle = "Cotton";
  } else {
    cycle = "Normal";
  }

  // ── Spin speed ───────────────────────────────────────────────────────────────
  const baseSpin: Record<Sensitivity, number> = {
    very_delicate: 400, delicate: 600, normal: 1000, sturdy: 1200,
  };
  let spinRPM = baseSpin[sens];
  if (spinLevel === "REDUCED") spinRPM = Math.min(spinRPM, 600);
  if (spinLevel === "NONE") spinRPM = 0;

  // ── Detergent ────────────────────────────────────────────────────────────────
  const m = materials.toLowerCase();
  let detergent: string;
  if (washMethod === "DRY_CLEAN") {
    detergent = "Take to a dry cleaner (no machine wash)";
  } else if (/\bwool\b|\bcashmere\b|\bmerino\b/.test(m)) {
    detergent = "Wool detergent";
  } else if (sens === "very_delicate" || sens === "delicate") {
    detergent = "Delicate / gentle detergent";
  } else if (colorGroup === "DARK" || colorGroup === "VIVID") {
    detergent = "Colour-protecting detergent";
  } else if (colorGroup === "WHITE") {
    detergent = "Regular detergent (+ whitener if needed)";
  } else {
    detergent = "Regular detergent";
  }

  // ── Pre-soak ─────────────────────────────────────────────────────────────────
  const preSoak = wornCount >= 5;

  // ── Dryer ────────────────────────────────────────────────────────────────────
  let dryer: WashRecommendation["dryer"];
  if (washMethod === "DRY_CLEAN" || dryMethod === "DRY_CLEAN") {
    dryer = { recommended: false, alternative: "Take to a dry cleaner" };
  } else if (dryMethod === "DO_NOT_DRY") {
    dryer = { recommended: false, alternative: "Do not tumble dry — air dry away from direct heat" };
  } else if (dryMethod === "AIR_FLAT" || sens === "very_delicate") {
    const alt = /\bwool\b|\bcashmere\b/.test(m)
      ? "Lay flat on a clean dry towel — hanging causes wool to stretch out of shape"
      : "Lay flat to dry on a clean towel";
    dryer = { recommended: false, alternative: alt };
  } else if (dryMethod === "AIR_LINE") {
    dryer = { recommended: false, alternative: "Hang on a clothesline or drying rack" };
  } else if (dryMethod === "AIR_DRIP") {
    dryer = { recommended: false, alternative: "Drip dry — hang directly after washing without wringing" };
  } else {
    const heat = dryMethod === "TUMBLE_HIGH" ? "high" : dryMethod === "TUMBLE_MEDIUM" ? "medium" : "low";
    const minutes = { high: 30, medium: 45, low: 60 }[heat];
    dryer = { recommended: true, heat, estimatedMinutes: minutes };
  }

  // ── Urgency ──────────────────────────────────────────────────────────────────
  const baseItems = type === "UNDERWEAR" || type === "SOCKS";
  let urgency: WashRecommendation["urgency"];
  let urgencyLabel: string;
  if (wornCount === 0) {
    urgency = "fresh"; urgencyLabel = "Freshly washed";
  } else if (baseItems) {
    urgency = "wash_now"; urgencyLabel = "Wash after every wear";
  } else if (wornCount <= 2) {
    urgency = "can_wait"; urgencyLabel = `${wornCount} wear${wornCount > 1 ? "s" : ""} — still fine`;
  } else if (wornCount <= 4) {
    urgency = "wash_soon"; urgencyLabel = `${wornCount} wears — wash soon`;
  } else {
    urgency = "wash_now"; urgencyLabel = `${wornCount} wears — wash now`;
  }

  // ── Notes ────────────────────────────────────────────────────────────────────
  const notes = fabricNotes(materials, colorGroup, type);
  if (preSoak) notes.push("Pre-soak for 30 min before washing for a deeper clean");
  if (washMethod === "HAND") notes.push("Use cool water — fill a basin, submerge and gently squeeze, do not rub");

  return { temperature: temp, cycle, spinRPM, detergent, preSoak, dryer, notes, urgency, urgencyLabel };
}
