export const dynamic = "force-dynamic";

import { isDateKey, todayKey, type DateKey } from "@/lib/dates";
import { mealDay } from "@/lib/meal-plan";
import { dayTracking } from "@/lib/meal-plan-service";
import DietDay from "@/components/self-care/DietDay";

export default async function DietPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const today = todayKey();
  const { date: raw } = await searchParams;
  const date: DateKey = raw && isDateKey(raw) ? raw : today;
  // Ticks and water are for today and the days before it; a day ahead only shows its plan.
  const tracking = mealDay(date) && date <= today ? await dayTracking(date) : null;
  // When it was rendered, so a copy served later from the offline cache knows it is one.
  const renderedAt = new Date().getTime();

  return <DietDay date={date} today={today} tracking={tracking} renderedAt={renderedAt} />;
}
