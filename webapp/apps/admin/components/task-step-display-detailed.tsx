"use client"

import { Card } from "@droiduse/shared-ui/card"
import { Badge } from "@droiduse/shared-ui/badge"
import {
  MousePointerClick,
  Type,
  Hand,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Brain,
  FileText,
  Smartphone,
  Eye
} from "lucide-react"
import { useState } from "react"
import { TaskStepVisualizerCompact } from "./task-step-visualizer"
import type { A11yNode, PhoneState, DeviceScreenSize } from "../lib/a11y-canvas-visualizer"
import type { Device } from "@droiduse/shared-prisma"

interface TaskStep {
  id: string
  stepNumber: number
  agentType: string
  actions?: any | null
  thought?: string | null
  description?: string | null
  subgoal?: string | null
  confidence?: number | null
  status: string
  error?: string | null
  summary?: string | null
  fullResponse?: string | null
  screenshotPath?: string | null
  a11yTree?: any | null
  phoneState?: any | null
  formattedText?: string | null
  createdAt: Date | string
  startedAt?: Date | string | null
  completedAt?: Date | string | null
}

interface DeviceWithType {
  id: string
  name: string
  deviceId: string
  status: string
  deviceType?: {
    widthPixels?: number | null
    heightPixels?: number | null
    manufacturer?: string | null
    model?: string | null
  } | null
}

interface TaskStepDisplayDetailedProps {
  step: TaskStep
  device?: DeviceWithType | null
}

// Helper function to render phone state in a readable format
function PhoneStateDisplay({ phoneState }: { phoneState: any }) {
  if (!phoneState || typeof phoneState !== 'object') return null

  const fields: Array<{
    key: string
    label: string
    icon?: any
    render?: (val: any) => string | number
  }> = [
    { key: 'currentApp', label: 'Current App', icon: Smartphone },
    { key: 'packageName', label: 'Package', icon: FileText },
    { key: 'activityName', label: 'Activity', icon: FileText },
    { key: 'isKeyboardVisible', label: 'Keyboard', render: (val: boolean) => val ? 'Visible' : 'Hidden' },
    { key: 'orientation', label: 'Orientation', render: (val: string) => val || 'Unknown' },
    { key: 'screenWidth', label: 'Screen Width', render: (val: number) => `${val}px` },
    { key: 'screenHeight', label: 'Screen Height', render: (val: number) => `${val}px` },
  ]

  return (
    <div className="grid grid-cols-1 gap-2">
      {fields.map(({ key, label, icon: Icon, render }) => {
        const value = phoneState[key]
        if (value === null || value === undefined) return null

        return (
          <div key={key} className="flex items-start gap-2 p-2 rounded bg-muted/50">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="text-sm font-mono break-all">
                {render ? render(value) : String(value)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Helper to extract action name from either { type: "click" } or { action: "tap_element" } format
function getActionName(action: any): string {
  return action?.type || action?.action || 'unknown'
}

// Helper function to format actions as function calls
function formatAction(action: any, index: number): string {
  if (!action || typeof action !== 'object') {
    return JSON.stringify(action)
  }

  const actionName = getActionName(action)
  // Remove both possible name keys from params
  const { type, action: actionKey, ...params } = action

  // Format parameters as function arguments
  const formatParams = (params: Record<string, any>): string => {
    const paramPairs = Object.entries(params)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k, v]) => {
        if (typeof v === 'string') {
          return `${k}="${v}"`
        } else if (typeof v === 'boolean') {
          return `${k}=${v}`
        } else if (typeof v === 'number') {
          return `${k}=${v}`
        } else if (typeof v === 'object') {
          return `${k}=${JSON.stringify(v)}`
        }
        return `${k}=${v}`
      })
    return paramPairs.join(', ')
  }

  const paramStr = formatParams(params)
  return paramStr ? `${actionName}(${paramStr})` : `${actionName}()`
}

export default function TaskStepDisplayDetailed({ step, device }: TaskStepDisplayDetailedProps) {
  const [isPhoneStateExpanded, setIsPhoneStateExpanded] = useState(true) // Expanded by default
  const [isFullResponseExpanded, setIsFullResponseExpanded] = useState(true) // Expanded by default
  const [isActionsExpanded, setIsActionsExpanded] = useState(false)
  const [isUIStateExpanded, setIsUIStateExpanded] = useState(false)
  const [isScreenTextExpanded, setIsScreenTextExpanded] = useState(false) // Folded by default
  const [showPhoneStateJSON, setShowPhoneStateJSON] = useState(false) // Toggle between UI and JSON

  // Extract screen size from device type
  const deviceScreenSize: DeviceScreenSize | undefined =
    device?.deviceType?.widthPixels && device?.deviceType?.heightPixels
      ? {
          width: device.deviceType.widthPixels,
          height: device.deviceType.heightPixels,
        }
      : undefined

  // Extract first action type for icon display
  const actions = Array.isArray(step.actions) ? step.actions : []
  const firstActionType = getActionName(actions[0])

  const actionIcons: Record<string, any> = {
    click: MousePointerClick,
    tap: MousePointerClick,
    tap_element: MousePointerClick,
    type: Type,
    input_text: Type,
    type_element: Type,
    swipe: Hand,
    long_press_element: Hand,
  }

  const ActionIcon = actionIcons[firstActionType] || MousePointerClick

  const statusConfig = {
    EXECUTING: { icon: Loader2, color: "text-primary", bg: "bg-primary/10", label: "Executing" },
    SUCCESS: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "Success" },
    FAILED: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Failed" },
  }

  const status = statusConfig[step.status as keyof typeof statusConfig] || statusConfig.SUCCESS
  const StatusIcon = status.icon

  return (
    <Card className="p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-6">
        {/* Left side: Visualizer */}
        {(step.a11yTree && step.phoneState) && (
          <div className="shrink-0 w-full max-w-[360px]">
            <div className="sticky top-4">
              <TaskStepVisualizerCompact
                tree={Array.isArray(step.a11yTree) ? step.a11yTree : []}
                phoneState={step.phoneState as PhoneState}
                deviceScreenSize={deviceScreenSize}
              />
            </div>
          </div>
        )}

        {/* Right side: Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-4 mb-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${status.bg} shrink-0`}>
              <ActionIcon className={`h-5 w-5 ${status.color}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <p className="font-medium">Step {step.stepNumber}</p>
                <Badge variant="secondary" className="gap-1.5">
                  <StatusIcon className={`h-3 w-3 ${status.color} ${step.status === 'EXECUTING' ? 'animate-spin' : ''}`} />
                  {status.label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {step.agentType}
                </Badge>
                {step.confidence !== null && step.confidence !== undefined && (
                  <Badge variant="outline">
                    {(step.confidence * 100).toFixed(0)}% confident
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {step.subgoal && (
            <div className="mb-3 rounded-lg bg-primary/5 border border-primary/10 p-4">
              <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide">Subgoal</p>
              <p className="text-base font-medium">{step.subgoal}</p>
            </div>
          )}

          {step.thought && (
            <div className="mb-2 rounded bg-blue-500/5 border border-blue-500/10 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Brain className="h-3 w-3 text-blue-500" />
                <p className="text-xs font-medium text-blue-500">Agent Thought</p>
              </div>
              <p className="text-sm text-muted-foreground">{step.thought}</p>
            </div>
          )}

          {step.description && (
            <p className="text-sm text-muted-foreground mb-2">
              {step.description}
            </p>
          )}

          {actions.length > 0 && (
            <div className="rounded bg-muted p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">
                  {actions.length === 1 ? 'Action:' : `Actions (${actions.length}):`}
                </p>
                {actions.length > 0 && (
                  <button
                    onClick={() => setIsActionsExpanded(!isActionsExpanded)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    {isActionsExpanded ? (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Hide JSON
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-3 w-3" />
                        Show JSON
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {actions.map((action, idx) => (
                  <div key={idx}>
                    <p className="text-sm font-mono">
                      {actions.length > 1 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium mr-2">
                          {idx + 1}
                        </span>
                      )}
                      {formatAction(action, idx)}
                    </p>
                    {isActionsExpanded && (
                      <pre className="text-xs font-mono text-muted-foreground mt-1 ml-7 break-all whitespace-pre-wrap">
                        {JSON.stringify(action, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step.summary && (
            <div className="mb-2 rounded bg-muted p-3">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Summary:</p>
              <p className="text-sm">{step.summary}</p>
            </div>
          )}

          {step.error && (
            <div className="mt-2 rounded bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-xs text-red-500 font-medium mb-1">Error:</p>
              <p className="text-sm text-red-500">{step.error}</p>
            </div>
          )}

          {step.screenshotPath && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <ImageIcon className="h-3 w-3" />
              <span>Screenshot: {step.screenshotPath}</span>
            </div>
          )}

          {step.formattedText && (
            <div className="mt-2">
              <button
                onClick={() => setIsScreenTextExpanded(!isScreenTextExpanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {isScreenTextExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <FileText className="h-3 w-3" />
                Screen Text
              </button>
              {isScreenTextExpanded && (
                <div className="mt-2 rounded bg-muted p-3 text-xs max-h-32 overflow-auto">
                  <pre className="whitespace-pre-wrap break-all font-mono">
                    {step.formattedText}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Accessibility Tree JSON */}
          {step.a11yTree && (
            <div className="mt-2">
              <button
                onClick={() => setIsUIStateExpanded(!isUIStateExpanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {isUIStateExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <Eye className="h-3 w-3" />
                Accessibility Tree JSON
              </button>
              {isUIStateExpanded && (
                <div className="mt-2 rounded bg-muted p-3 text-xs font-mono max-h-60 overflow-auto">
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(step.a11yTree, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Phone State - Better UI display */}
          {step.phoneState && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setIsPhoneStateExpanded(!isPhoneStateExpanded)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isPhoneStateExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <Smartphone className="h-3 w-3" />
                  Phone State
                </button>
                {isPhoneStateExpanded && (
                  <button
                    onClick={() => setShowPhoneStateJSON(!showPhoneStateJSON)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPhoneStateJSON ? 'Show UI' : 'Show JSON'}
                  </button>
                )}
              </div>
              {isPhoneStateExpanded && (
                <div className="mt-2">
                  {showPhoneStateJSON ? (
                    <div className="rounded bg-muted p-3 text-xs font-mono max-h-60 overflow-auto">
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(step.phoneState, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <PhoneStateDisplay phoneState={step.phoneState} />
                  )}
                </div>
              )}
            </div>
          )}

          {step.fullResponse && (
            <div className="mt-2">
              <button
                onClick={() => setIsFullResponseExpanded(!isFullResponseExpanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {isFullResponseExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Full LLM Response
              </button>
              {isFullResponseExpanded && (
                <div className="mt-2 rounded bg-muted p-3 text-xs font-mono max-h-60 overflow-auto">
                  <pre className="whitespace-pre-wrap break-all">
                    {step.fullResponse}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
