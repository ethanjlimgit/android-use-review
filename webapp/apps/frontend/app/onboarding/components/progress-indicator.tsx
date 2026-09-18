import { cn } from "@droiduse/shared-ui"

interface ProgressIndicatorProps {
  currentStep: number
  totalSteps: number
}

export function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            i <= currentStep ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  )
}
