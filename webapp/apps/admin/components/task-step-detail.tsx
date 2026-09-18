"use client"

import { useState } from "react"
import { Badge } from "@droiduse/shared-ui/badge"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@droiduse/shared-ui/collapsible"
import { format } from "date-fns"
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react"

type TaskStepDetailProps = {
  step: {
    id: string
    stepNumber: number
    agentType: string
    actions: any[] | null
    thought: string | null
    description: string | null
    subgoal: string | null
    confidence: number | null
    status: string
    error: string | null
    summary: string | null
    fullResponse: string | null
    a11yTree: any | null
    phoneState: any | null
    formattedText: string | null
    createdAt: Date
    startedAt: Date | null
    completedAt: Date | null
  }
}

function JsonViewer({ data, title }: { data: any; title: string }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!data) {
    return <div className="text-sm text-muted-foreground">No {title.toLowerCase()} data</div>
  }

  return (
    <div className="space-y-2">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between">
            <span>{title}</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-xs">
            <code>{JSON.stringify(data, null, 2)}</code>
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function PhoneStateViewer({ phoneState }: { phoneState: any }) {
  if (!phoneState) {
    return <div className="text-sm text-muted-foreground">No phone state data</div>
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        {phoneState.currentApp && (
          <div>
            <div className="text-xs font-medium text-muted-foreground">Current App</div>
            <div className="text-sm">{phoneState.currentApp}</div>
          </div>
        )}
        {phoneState.packageName && (
          <div>
            <div className="text-xs font-medium text-muted-foreground">Package Name</div>
            <div className="text-sm font-mono">{phoneState.packageName}</div>
          </div>
        )}
        {phoneState.activityName && (
          <div>
            <div className="text-xs font-medium text-muted-foreground">Activity</div>
            <div className="text-sm font-mono">{phoneState.activityName}</div>
          </div>
        )}
        {phoneState.keyboardVisible !== undefined && (
          <div>
            <div className="text-xs font-medium text-muted-foreground">Keyboard</div>
            <div className="text-sm">{phoneState.keyboardVisible ? "Visible" : "Hidden"}</div>
          </div>
        )}
        {phoneState.isEditable !== undefined && (
          <div>
            <div className="text-xs font-medium text-muted-foreground">Editable</div>
            <div className="text-sm">{phoneState.isEditable ? "Yes" : "No"}</div>
          </div>
        )}
      </div>
      <JsonViewer data={phoneState} title="Full Phone State JSON" />
    </div>
  )
}

export function TaskStepDetail({ step }: TaskStepDetailProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getStatusIcon = () => {
    switch (step.status) {
      case "SUCCESS":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "FAILED":
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return null
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <CardTitle className="text-lg">
                Step {step.stepNumber}
              </CardTitle>
            </div>
            <Badge variant="outline">{step.agentType}</Badge>
            <Badge variant={step.status === "SUCCESS" ? "default" : "destructive"}>
              {step.status}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Expand
              </>
            )}
          </Button>
        </div>
        {step.description && (
          <div className="text-sm text-muted-foreground mt-2">{step.description}</div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {step.subgoal && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Subgoal</div>
                <div className="mt-1 text-sm">{step.subgoal}</div>
              </div>
            )}
            {step.confidence !== null && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Confidence</div>
                <div className="mt-1 text-sm">{(step.confidence * 100).toFixed(1)}%</div>
              </div>
            )}
          </div>

          {/* Thought Process */}
          {step.thought && (
            <div>
              <div className="text-sm font-medium mb-2">Agent Thought</div>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-xs whitespace-pre-wrap font-mono">{step.thought}</pre>
              </div>
            </div>
          )}

          {/* Summary */}
          {step.summary && (
            <div>
              <div className="text-sm font-medium mb-2">Summary</div>
              <div className="bg-muted p-4 rounded-lg text-sm">{step.summary}</div>
            </div>
          )}

          {/* Actions */}
          {step.actions && step.actions.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Actions ({step.actions.length})</div>
              <div className="space-y-2">
                {step.actions.map((action: any, idx: number) => (
                  <div key={idx} className="bg-muted p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{action.type || action.action || "unknown"}</Badge>
                    </div>
                    <pre className="text-xs">{JSON.stringify(action, null, 2)}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {step.error && (
            <div>
              <div className="text-sm font-medium mb-2 text-red-500">Error</div>
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <pre className="text-xs text-red-700 whitespace-pre-wrap">{step.error}</pre>
              </div>
            </div>
          )}

          {/* Phone State */}
          <div>
            <div className="text-sm font-medium mb-2">Phone State</div>
            <PhoneStateViewer phoneState={step.phoneState} />
          </div>

          {/* A11y Tree */}
          <div>
            <div className="text-sm font-medium mb-2">Accessibility Tree</div>
            <JsonViewer data={step.a11yTree} title="View A11y Tree" />
          </div>

          {/* Formatted Text */}
          {step.formattedText && (
            <div>
              <div className="text-sm font-medium mb-2">Formatted Text (for LLM)</div>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-xs whitespace-pre-wrap font-mono overflow-auto max-h-64">
                  {step.formattedText}
                </pre>
              </div>
            </div>
          )}

          {/* Full Response */}
          {step.fullResponse && (
            <div>
              <div className="text-sm font-medium mb-2">Full LLM Response</div>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-64">
                  {step.fullResponse}
                </pre>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Created</div>
              <div className="text-sm">{format(new Date(step.createdAt), "HH:mm:ss.SSS")}</div>
            </div>
            {step.startedAt && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">Started</div>
                <div className="text-sm">{format(new Date(step.startedAt), "HH:mm:ss.SSS")}</div>
              </div>
            )}
            {step.completedAt && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">Completed</div>
                <div className="text-sm">{format(new Date(step.completedAt), "HH:mm:ss.SSS")}</div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
