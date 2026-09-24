import { redirect } from "next/navigation";

// One category so far, so the section opens straight into it.
export default function StudyPage() {
  redirect("/study/sat-vocab");
}
