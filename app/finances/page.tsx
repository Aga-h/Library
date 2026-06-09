import { redirect } from "next/navigation";

export default function FinancesPage() {
  const now = new Date();
  redirect(`/finances/${now.getFullYear()}/${now.getMonth() + 1}`);
}
