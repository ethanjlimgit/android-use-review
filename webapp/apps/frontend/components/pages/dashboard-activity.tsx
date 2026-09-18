"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@droiduse/shared-ui/card";
import { Activity, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import type { Task } from "@droiduse/shared-lib";

export default function DashboardActivity() {
  const router = useRouter();
  const { data, isLoading: loadingTasks } = useQuery<{ tasks: Task[]; nextCursor: string | null }>({
    queryKey: ["/api/tasks"],
  });
  const recentTasks = data?.tasks;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "FAILED":
      case "TIMED_OUT":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "RUNNING":
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case "PENDING":
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-500/10";
      case "FAILED":
      case "TIMED_OUT":
        return "bg-red-500/10";
      case "RUNNING":
        return "bg-primary/10";
      case "PENDING":
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="space-y-4">
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
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getStatusColor(task.status)}`}>
                  {getStatusIcon(task.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" data-testid={`text-task-${task.id}`}>
                    {task.goal}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
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
    </div>
  );
}

