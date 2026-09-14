// Stat levelling — a natural-log curve through (0, 0): fast early, slower forever after.
//
//   level(xp)  = floor(CURVE_HEIGHT * ln(1 + xp / XP_SCALE))
//   xpFor(lvl) = XP_SCALE * (e^(lvl / CURVE_HEIGHT) - 1)
//
// 1 XP = 1 minute of work on a completed task. Every stat a module trains gets
// the full amount, and every stat starts at level 0.

export const CURVE_HEIGHT = 5;
export const XP_SCALE = 120;

export function levelFromXp(xp: number): number {
  if (xp <= 0) return 0;
  return Math.floor(CURVE_HEIGHT * Math.log1p(xp / XP_SCALE));
}

/** Total XP needed to reach the given level. */
export function xpForLevel(level: number): number {
  if (level <= 0) return 0;
  return Math.ceil(XP_SCALE * (Math.exp(level / CURVE_HEIGHT) - 1));
}

export interface LevelProgress {
  level: number;
  xp: number;
  /** XP earned since reaching the current level. */
  into: number;
  /** XP the current level spans. */
  span: number;
  /** Total XP at which the next level unlocks. */
  nextAt: number;
  /** XP still to go. */
  remaining: number;
  /** 0–1 through the current level. */
  ratio: number;
}

export function levelProgress(xp: number): LevelProgress {
  const total = Math.max(0, Math.round(xp));
  const level = levelFromXp(total);
  const floorXp = xpForLevel(level);
  const nextAt = xpForLevel(level + 1);
  const span = Math.max(1, nextAt - floorXp);
  const into = total - floorXp;
  return {
    level,
    xp: total,
    into,
    span,
    nextAt,
    remaining: Math.max(0, nextAt - total),
    ratio: Math.min(1, Math.max(0, into / span)),
  };
}

/** Minutes of task work still needed for the next level. */
export function minutesToNextLevel(xp: number): number {
  return levelProgress(xp).remaining;
}
