"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@droiduse/shared-ui/button";
import { Card, CardContent } from "@droiduse/shared-ui/card";
import { DeviceCard, DeviceCardSkeleton } from "@/components/device-card";
import { Smartphone, ArrowRight } from "lucide-react";
import type { Device } from "@droiduse/shared-lib";

export default function DashboardDevices() {
  const { data: myDevices, isLoading: loadingDevices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  return (
    <div className="space-y-4">
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
    </div>
  );
}

