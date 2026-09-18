"use client"

import { Card } from "@droiduse/shared-ui/card"
import { Badge } from "@droiduse/shared-ui/badge"
import {
  MousePointerClick,
  Type,
  Hand,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react"

interface TaskStep {
  id: string
  stepNumber: number
  agentType: string
  actions?: any | null
  description?: string | null
  status: string
  error?: string | null
  createdAt: Date | string
}

interface TaskStepOverviewProps {
  step: TaskStep
}

// Helper function to get primary action from actions array
function getPrimaryAction(actions: any): string {
  if (!actions) return 'No action'

  const actionArray = Array.isArray(actions) ? actions : [actions]
  if (actionArray.length === 0) return 'No action'

  const action = actionArray[0]
  if (!action || typeof action !== 'object') return 'Unknown action'

  const { type, ...params } = action

  switch (type) {
    case 'tap':
    case 'click':
      if (params.index !== undefined) {
        return `Tap element #${params.index}`
      }
      return 'Tap'

    case 'input_text':
    case 'type':
      const text = params.text || params.value || ''
      return `Type "${text.length > 20 ? text.substring(0, 20) + '...' : text}"`

    case 'swipe':
      return `Swipe ${params.direction || ''}`

    case 'scroll':
      return `Scroll ${params.direction || 'down'}`

    case 'press_back':
      return 'Back'

    case 'press_home':
      return 'Home'

    case 'long_press':
      return 'Long press'

    case 'wait':
      return `Wait ${params.duration || params.seconds || 1}s`

    default:
      return type || 'Unknown'
  }
}

export default function TaskStepOverview({ step }: TaskStepOverviewProps) {
  // Extract first action type for icon display
  const actions = Array.isArray(step.actions) ? step.actions : []
  const firstActionType = actions[0]?.type || 'unknown'

  const actionIcons: Record<string, any> = {
    click: MousePointerClick,
    tap: MousePointerClick,
    type: Type,
    input_text: Type,
    swipe: Hand,
  }

  const ActionIcon = actionIcons[firstActionType] || MousePointerClick

  const statusConfig = {
    EXECUTING: { icon: Loader2, color: "text-primary", bg: "bg-primary/10", label: "Running" },
    SUCCESS: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "Success" },
    FAILED: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Failed" },
  }

  const status = statusConfig[step.status as keyof typeof statusConfig] || statusConfig.SUCCESS
  const StatusIcon = status.icon

  const primaryAction = getPrimaryAction(step.actions)

  return (
    <Card className="p-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        {/* Step Number Circle */}
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
          {step.stepNumber}
        </div>

        {/* Action Icon */}
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${status.bg} shrink-0`}>
          <ActionIcon className={`h-4 w-4 ${status.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium truncate">{primaryAction}</p>
            {actions.length > 1 && (
              <Badge variant="outline" className="text-xs">
                +{actions.length - 1} more
              </Badge>
            )}
          </div>

          {step.description && (
            <p className="text-xs text-muted-foreground truncate">
              {step.description}
            </p>
          )}

          {step.error && (
            <p className="text-xs text-red-500 truncate mt-1">
              Error: {step.error}
            </p>
          )}
        </div>

        {/* Status Badge */}
        <Badge variant={step.status === 'SUCCESS' ? 'default' : step.status === 'FAILED' ? 'destructive' : 'secondary'} className="gap-1.5 shrink-0">
          <StatusIcon className={`h-3 w-3 ${step.status === 'EXECUTING' ? 'animate-spin' : ''}`} />
          {status.label}
        </Badge>
      </div>
    </Card>
  )
}
