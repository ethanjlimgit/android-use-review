"use client";

import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/stats-card";
import { Package, Smartphone, Activity, Star } from "lucide-react";
import type { SkillWithApp, Device } from "@droiduse/shared-lib";

export default function DashboardStats() {
  const { data: mySkills } = useQuery<SkillWithApp[]>({
    queryKey: ["/api/skills/mine"],
  });

  const { data: myDevices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const { data: tasksResponse } = useQuery<{ tasks: any[]; nextCursor: string | null }>({
    queryKey: ["/api/tasks"],
  });

  const stats = {
    contributions: mySkills?.length || 0,
    devices: myDevices?.length || 0,
    tasks: tasksResponse?.tasks?.length || 0,
    score: mySkills?.reduce((acc, k) => acc + (k.score || 0), 0) || 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Stats</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Contributions"
          value={stats.contributions}
          icon={Package}
          trend={{ value: 12, positive: true }}
        />
        <StatsCard
          title="Devices"
          value={stats.devices}
          icon={Smartphone}
          description={`${myDevices?.filter((d) => d.status === "online").length || 0} online`}
        />
        <StatsCard
          title="Tasks"
          value={stats.tasks}
          icon={Activity}
          trend={{ value: 8, positive: true }}
        />
        <StatsCard
          title="Total Score"
          value={stats.score}
          icon={Star}
          trend={{ value: 5, positive: true }}
        />
      </div>
    </div>
  );
}
