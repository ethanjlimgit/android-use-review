"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@droiduse/shared-ui/card";

// Dynamic imports for dashboard tabs - only load the active tab
const DashboardSkills = dynamic(() => import("@/components/pages/dashboard-skills"), {
  loading: () => <DashboardTabSkeleton />,
});

const DashboardDevices = dynamic(() => import("@/components/pages/dashboard-devices"), {
  loading: () => <DashboardTabSkeleton />,
});

const DashboardActivity = dynamic(() => import("@/components/pages/dashboard-activity"), {
  loading: () => <DashboardTabSkeleton />,
});

const DashboardStats = dynamic(() => import("@/components/pages/dashboard-stats"), {
  loading: () => <DashboardTabSkeleton />,
});

const validTabs = ["skills", "devices", "activity", "stats"];

function DashboardTabSkeleton() {
  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 space-y-2">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-96 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-12 w-12 bg-muted animate-pulse rounded-lg" />
                  <div className="space-y-2">
                    <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardTabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = params.tab as string;

  useEffect(() => {
    if (!validTabs.includes(tab)) {
      router.replace("/dashboard/skills");
    }
  }, [tab, router]);

  if (!validTabs.includes(tab)) {
    return null;
  }

  switch (tab) {
    case "skills":
      return <DashboardSkills />;
    case "devices":
      return <DashboardDevices />;
    case "activity":
      return <DashboardActivity />;
    case "stats":
      return <DashboardStats />;
    default:
      return null;
  }
}
