"use client"

import { AgentServerMonitoring } from "@/components/agent-server-monitoring"

export default function AgentServersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agent Servers</h1>
        <p className="text-muted-foreground">
          Monitor and manage backend agent servers
        </p>
      </div>

      <AgentServerMonitoring />
    </div>
  )
}
