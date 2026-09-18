"use client";

import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Package, Smartphone, Activity } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@droiduse/shared-ui/tabs";

export function DashboardTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = pathname?.split("/").pop() || "skills";

  const handleTabChange = (value: string) => {
    router.push(`/dashboard/${value}`);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">
      <TabsList>
        <TabsTrigger value="skills" className="gap-1.5">
          <Package className="h-4 w-4" />
          My Skills
        </TabsTrigger>
        <TabsTrigger value="devices" className="gap-1.5">
          <Smartphone className="h-4 w-4" />
          My Devices
        </TabsTrigger>
        <TabsTrigger value="activity" className="gap-1.5">
          <Activity className="h-4 w-4" />
          Recent Activity
        </TabsTrigger>
        <TabsTrigger value="stats" className="gap-1.5">
          <BarChart3 className="h-4 w-4" />
          Stats
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
