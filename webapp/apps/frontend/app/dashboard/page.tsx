import { redirect } from "next/navigation";

export default function Page() {
  // Redirect to default tab
  redirect("/dashboard/skills");
}
