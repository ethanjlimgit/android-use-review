"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAnalytics } from "@/providers/analytics-provider";
import { useSettings } from "@/providers/settings-provider";
import { Button } from "@droiduse/shared-ui/button";
import { Input } from "@droiduse/shared-ui/input";
import { Label } from "@droiduse/shared-ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card";
import { Badge } from "@droiduse/shared-ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@droiduse/shared-ui/dialog";
import { DeviceCard, DeviceCardSkeleton } from "@/components/device-card";
import { useToast } from "@droiduse/shared-ui/use-toast";
import { apiRequest, queryClient } from "@droiduse/shared-lib";
import {
  Plus,
  Smartphone,
  QrCode,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import type { Device } from "@droiduse/shared-lib";

export default function Devices() {
  const analytics = useAnalytics()
  const { toast } = useToast();
  const { getSetting } = useSettings();
  const siteName = getSetting("site.name");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pairCode, setPairCode] = useState("");

  const { data: devices, isLoading, refetch } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const addDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiRequest("POST", "/api/devices", {
        name: `Device ${(devices?.length || 0) + 1}`,
        deviceId,
        androidVersion: "14",
        status: "offline",
      });
    },
    onSuccess: () => {
      analytics.capture("device_added", {
        device_count: (devices?.length || 0) + 1,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setDialogOpen(false);
      setPairCode("");
      toast({
        title: "Device added",
        description: `Your device has been added successfully. Install the ${siteName} app to connect.`,
      });
    },
    onError: (error) => {
      analytics.captureException(error);
      toast({
        title: "Error",
        description: "Failed to add device. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddDevice = () => {
    if (pairCode.trim()) {
      addDeviceMutation.mutate(pairCode.trim());
    }
  };

  const onlineDevices = devices?.filter((d) => d.status === "online").length || 0;
  const offlineDevices = devices?.filter((d) => d.status === "offline").length || 0;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Device Management</h1>
            <p className="mt-2 text-muted-foreground">
              Connect and control your Android devices
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-devices">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-add-device">
                  <Plus className="h-4 w-4" />
                  Add Device
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Device</DialogTitle>
                  <DialogDescription>
                    Enter the pairing code from the {siteName} app on your Android device.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex justify-center">
                    <div className="flex h-32 w-32 items-center justify-center rounded-lg border-2 border-dashed border-border">
                      <QrCode className="h-16 w-16 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="text-center text-sm text-muted-foreground">
                    Scan this QR code or enter the pairing code manually
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pair-code">Pairing Code</Label>
                    <Input
                      id="pair-code"
                      placeholder="Enter 6-digit code"
                      value={pairCode}
                      onChange={(e) => setPairCode(e.target.value)}
                      className="text-center text-lg tracking-widest"
                      maxLength={6}
                      data-testid="input-pair-code"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddDevice}
                    disabled={!pairCode.trim() || addDeviceMutation.isPending}
                    data-testid="button-confirm-add-device"
                  >
                    {addDeviceMutation.isPending ? "Adding..." : "Add Device"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Devices</p>
                  <p className="text-2xl font-bold" data-testid="text-total-devices">
                    {devices?.length || 0}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Online</p>
                  <p className="text-2xl font-bold" data-testid="text-online-devices">
                    {onlineDevices}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                  <Wifi className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Offline</p>
                  <p className="text-2xl font-bold" data-testid="text-offline-devices">
                    {offlineDevices}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <WifiOff className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Devices</h2>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <DeviceCardSkeleton key={i} />
              ))}
            </div>
          ) : devices && devices.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
                  <Smartphone className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No devices connected</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Download the {siteName} app on your Android device and pair it with your account to get started.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button onClick={() => setDialogOpen(true)} className="gap-2" data-testid="button-add-first-device">
                    <Plus className="h-4 w-4" />
                    Add Your First Device
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="#" target="_blank" rel="noopener noreferrer">
                      Download App
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
