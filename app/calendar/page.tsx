import { redirect } from "next/navigation";
import { todayKey } from "@/lib/calendar-dates";

export default function CalendarPage() {
  // todayKey resolves in the user's timezone, not the server's. The deploy region is UTC+9 and
  // the user is UTC+3, so a bare new Date() here would open the wrong month for six hours a day
  // around a month boundary.
  const today = todayKey();
  redirect(`/calendar/${Number(today.slice(0, 4))}/${Number(today.slice(5, 7))}`);
}
