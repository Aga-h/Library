// The validation rule for a weekly goal, shared by the overall-goal route and the module routes.
// Kept apart from lib/goals.ts so that pure module stays free of zod for the client bundle.

import { z } from "zod";
import { hoursToMinutes, MAX_WEEKLY_GOAL_HOURS } from "@/lib/goals";

/** Hours, or null to clear the goal. Anything that rounds to under a minute is not a goal. */
export const weeklyGoalHours = z
  .number()
  .positive("A goal has to be more than zero — clear it instead")
  .max(MAX_WEEKLY_GOAL_HOURS, `A week only has ${MAX_WEEKLY_GOAL_HOURS} hours`)
  .refine((h) => hoursToMinutes(h) >= 1, "Under a minute is not a goal")
  .nullable();
