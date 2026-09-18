import { Navigation } from "@/components/navigation";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@droiduse/shared-ui/button";
import { Smartphone, Plus } from "lucide-react";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { checkOnboarding } from "@/components/onboarding-guard";
import DashboardDemoRequest from "@/components/pages/dashboard-demo-request";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  if (session.user.product === "androiduse") {
    return (
      <>
        <Navigation />
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <DashboardDemoRequest />
          </div>
        </div>
      </>
    );
  }

  await checkOnboarding();

  return (
    <>
      <Navigation />
      <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="mt-2 text-muted-foreground">
                Welcome back! Here's an overview of your activity.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/devices">
                <Button variant="outline" className="gap-2" data-testid="button-add-device">
                  <Smartphone className="h-4 w-4" />
                  Add Device
                </Button>
              </Link>
              <Link href="/contribute">
                <Button className="gap-2" data-testid="button-contribute">
                  <Plus className="h-4 w-4" />
                  Contribute
                </Button>
              </Link>
            </div>
          </div>

          <DashboardTabs />

          {children}
        </div>
      </div>
    </>
  );
}

