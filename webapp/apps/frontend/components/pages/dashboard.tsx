"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@droiduse/shared-ui/button";
import { Card, CardContent } from "@droiduse/shared-ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@droiduse/shared-ui/tabs";
import { StatsCard } from "@/components/stats-card";
import { SkillCard, SkillCardSkeleton } from "@/components/skill-card";
import { DeviceCard, DeviceCardSkeleton } from "@/components/device-card";
import {
  Package,
  Smartphone,
  Activity,
  Star,
  Plus,
  ArrowRight,
  Clock,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import type { SkillWithApp, Device, Task } from "@droiduse/shared-lib";

type DashboardData = {
  skills: SkillWithApp[];
  devices: Device[];
  tasks: Task[];
};

export default function Dashboard() {
  const router = useRouter();

  // Consolidated dashboard query - single API call instead of 3
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  const mySkills = data?.skills || [];
  const myDevices = data?.devices || [];
  const recentTasks = data?.tasks || [];

  const loadingSkills = isLoading;
  const loadingDevices = isLoading;
  const loadingTasks = isLoading;

  const stats = {
    contributions: mySkills.length,
    devices: myDevices.length,
    tasks: recentTasks.length,
    score: mySkills.reduce((acc, k) => acc + (k.score || 0), 0),
  };

  return (
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

        <Tabs defaultValue="activity" className="space-y-6">
          <TabsList>
            <TabsTrigger value="activity" data-testid="tab-activity">Recent Activity</TabsTrigger>
            <TabsTrigger value="skills" data-testid="tab-my-skills">My Skills</TabsTrigger>
            <TabsTrigger value="devices" data-testid="tab-my-devices">My Devices</TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats">
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Activity</h2>
            </div>

            {loadingTasks ? (
              <Card>
                <CardContent className="p-6 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : recentTasks && recentTasks.length > 0 ? (
              <Card>
                <CardContent className="p-6">
                  <div className="divide-y divide-border">
                    {recentTasks.slice(0, 10).map((task) => (
                      <div
                        key={task.id}
                        onClick={() => {
                          if (task.deviceId) {
                            router.push(`/devices/${task.deviceId}/tasks?taskId=${task.id}`);
                          }
                        }}
                        className={`flex items-start gap-4 py-4 first:pt-0 last:pb-0 ${
                          task.deviceId ? "cursor-pointer hover:bg-muted/50 transition-colors rounded-lg -mx-2 px-2" : ""
                        }`}
                      >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        task.status === "COMPLETED"
                          ? "bg-green-500/10"
                          : task.status === "FAILED" || task.status === "TIMED_OUT"
                          ? "bg-red-500/10"
                          : task.status === "RUNNING"
                          ? "bg-primary/10"
                          : "bg-muted"
                      }`}>
                        {task.status === "COMPLETED" ? (
                          <Activity className="h-5 w-5 text-green-500" />
                        ) : task.status === "FAILED" || task.status === "TIMED_OUT" ? (
                          <Clock className="h-5 w-5 text-red-500" />
                        ) : (
                          <TrendingUp className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" data-testid={`text-task-${task.id}`}>
                          {task.goal}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="capitalize">{task.status.toLowerCase()}</span>
                          {task.createdAt && (
                            <>
                              <span>•</span>
                              <span>{new Date(task.createdAt).toLocaleString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                    <Activity className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">No recent activity</h3>
                  <p className="text-muted-foreground">
                    Your tasks will appear here
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="skills" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Skills</h2>
              <Link href="/marketplace">
                <Button variant="ghost" size="sm" className="gap-1" data-testid="button-view-all-skills">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {loadingSkills ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkillCardSkeleton key={i} />
                ))}
              </div>
            ) : mySkills && mySkills.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mySkills.slice(0, 6).map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">No skills yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Share your skills with the community
                  </p>
                  <Link href="/contribute">
                    <Button data-testid="button-start-contributing-empty">
                      Start Contributing
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="devices" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Connected Devices</h2>
              <Link href="/devices">
                <Button variant="ghost" size="sm" className="gap-1" data-testid="button-manage-devices">
                  Manage
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {loadingDevices ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <DeviceCardSkeleton key={i} />
                ))}
              </div>
            ) : myDevices && myDevices.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myDevices.slice(0, 6).map((device) => (
                  <DeviceCard key={device.id} device={device} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                    <Smartphone className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">No devices connected</h3>
                  <p className="text-muted-foreground mb-4">
                    Connect your Android device to get started
                  </p>
                  <Link href="/devices">
                    <Button data-testid="button-connect-device-empty">
                      Connect Device
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
