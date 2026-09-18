"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Badge } from "@droiduse/shared-ui/badge"
import { Button } from "@droiduse/shared-ui/button"
import { RefreshCw } from "lucide-react"
import { format } from "date-fns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@droiduse/shared-ui/table"
import { Switch } from "@droiduse/shared-ui/switch"
import { toast } from "@droiduse/shared-ui/use-toast"

interface AgentServer {
  id: string
  name: string
  ipAddress: string
  privateIpAddress: string
  port: number
  status: string
  enabled: boolean
  lastPing: string | null
  region: string | null
  capacity: number
  activeConnections: number
  description: string | null
  createdAt: string
  updatedAt: string
}

async function fetchServers(): Promise<AgentServer[]> {
  const response = await fetch("/api/agent-servers")
  if (!response.ok) throw new Error("Failed to fetch servers")
  const data = await response.json()
  return data.servers
}

function getStatusFromLastPing(lastPing: string | null): "online" | "offline" {
  if (!lastPing) return "offline"

  const pingTime = new Date(lastPing)
  const now = new Date()
  const diffMinutes = (now.getTime() - pingTime.getTime()) / 1000 / 60

  // Consider offline if no heartbeat in last 2 minutes
  return diffMinutes < 2 ? "online" : "offline"
}

export function AgentServerMonitoring() {
  const { data: servers, isLoading, refetch } = useQuery({
    queryKey: ["agent-servers"],
    queryFn: fetchServers,
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  const toggleEnabled = async (server: AgentServer) => {
    try {
      const response = await fetch("/api/agent-servers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: server.id, enabled: !server.enabled }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Agent server updated successfully",
        })
        refetch()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to update agent server",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating server:", error)
      toast({
        title: "Error",
        description: "Failed to update agent server",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Server Status</CardTitle>
          <CardDescription>Loading server status...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!servers || servers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Agent Servers</CardTitle>
          <CardDescription>
            No agent servers registered yet. Servers will appear here automatically when they send their first heartbeat.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Server Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agent Servers</CardTitle>
              <CardDescription>
                Monitor backend agent servers (auto-refresh every 10 seconds)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Public IP</TableHead>
                <TableHead>Private IP</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Connections</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Ping</TableHead>
                <TableHead>Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servers.map((server) => {
                const actualStatus = getStatusFromLastPing(server.lastPing)

                return (
                  <TableRow key={server.id}>
                    <TableCell>
                      <span className="font-medium">{server.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{server.ipAddress}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{server.privateIpAddress}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{server.port}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{server.region || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <span>{server.capacity}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{server.activeConnections}</span>
                        <span className="text-xs text-muted-foreground">/ {server.capacity}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={actualStatus === "online" ? "default" : "secondary"}>
                        {actualStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {server.lastPing ? (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(server.lastPing), "MMM d, HH:mm")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={server.enabled}
                        onCheckedChange={() => toggleEnabled(server)}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Monitoring Information */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoring Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            <strong>Status Detection:</strong> Servers are considered "online" if they have sent a heartbeat within the last 2 minutes.
          </p>
          <p className="text-muted-foreground">
            <strong>Heartbeat:</strong> Agent servers should POST to <code className="px-1 py-0.5 bg-muted rounded">/api/agent-servers/heartbeat</code> periodically.
          </p>
          <p className="text-muted-foreground">
            <strong>Auto-refresh:</strong> This page automatically refreshes every 10 seconds.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
