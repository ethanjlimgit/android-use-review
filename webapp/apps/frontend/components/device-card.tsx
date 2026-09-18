"use client";

import { memo, useState, useCallback, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card";
import { Badge } from "@droiduse/shared-ui/badge";
import { Button } from "@droiduse/shared-ui/button";
import { Textarea } from "@droiduse/shared-ui/textarea";
import Link from "next/link";
import { Smartphone, Send, Clock, ChevronDown, ChevronUp, History } from "lucide-react";
import type { Device } from "@droiduse/shared-lib";

interface DeviceCardProps {
  device: Device;
  onSendInstruction?: (deviceId: string, instruction: string) => void;
}

const statusColors = {
  online: "bg-green-500",
  offline: "bg-gray-500",
  busy: "bg-amber-500",
};

export const DeviceCard = memo(function DeviceCard({ device, onSendInstruction }: DeviceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [instruction, setInstruction] = useState("");

  const handleSend = useCallback(() => {
    if (instruction.trim() && onSendInstruction) {
      onSendInstruction(device.id, instruction.trim());
      setInstruction("");
    }
  }, [instruction, onSendInstruction, device.id]);

  const lastActiveText = useMemo(() => {
    return device.lastActive
      ? formatDistanceToNow(new Date(device.lastActive), { addSuffix: true })
      : "Never";
  }, [device.lastActive]);

  return (
    <Card className="overflow-visible">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base" data-testid={`text-device-name-${device.id}`}>
                {device.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{device.osVersion}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="gap-1.5"
                data-testid={`badge-device-status-${device.id}`}
              >
                <span className={`h-2 w-2 rounded-full ${statusColors[device.status as keyof typeof statusColors] || statusColors.offline}`} />
                {device.status?.charAt(0).toUpperCase()}{device.status?.slice(1)}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setExpanded(!expanded)}
                data-testid={`button-expand-device-${device.id}`}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <Link href={`/devices/${device.id}/tasks`}>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-7 text-xs"
                data-testid={`button-device-history-${device.id}`}
              >
                <History className="h-3 w-3" />
                History
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              Last active: {lastActiveText}
            </span>
          </div>

          <div className="space-y-2">
            <Textarea
              placeholder="Enter instruction to send to device..."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="min-h-[80px] resize-none"
              data-testid={`input-instruction-${device.id}`}
            />
            <Button
              onClick={handleSend}
              disabled={!instruction.trim() || device.status !== "online"}
              className="w-full gap-2"
              data-testid={`button-send-instruction-${device.id}`}
            >
              <Send className="h-4 w-4" />
              Send Instruction
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
});

export function DeviceCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-1">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
        </div>
      </CardHeader>
    </Card>
  );
}
