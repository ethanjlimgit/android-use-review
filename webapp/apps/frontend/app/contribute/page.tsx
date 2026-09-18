import { Navigation } from "@/components/navigation";
import Contribute from "@/components/pages/contribute";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { checkOnboarding } from "@/components/onboarding-guard";

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  await checkOnboarding();

  return (
    <>
      <Navigation />
      <Contribute />
    </>
  );
}

