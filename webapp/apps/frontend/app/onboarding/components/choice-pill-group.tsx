"use client"

import { Button } from "@droiduse/shared-ui/button"
import { cn } from "@droiduse/shared-ui/utils"

interface ChoiceOption {
  value: string
  label: string
  description?: string
}

interface ChoicePillGroupProps {
  options: ChoiceOption[]
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function ChoicePillGroup({
  options,
  value,
  onChange,
  disabled,
  className,
}: ChoicePillGroupProps) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {options.map((option) => {
        const isSelected = option.value === value

        return (
          <Button
            key={option.value}
            type="button"
            variant={isSelected ? "default" : "outline"}
            size="sm"
            className={cn(
              "rounded-full px-4 py-2 border text-sm font-medium",
              "transition-all",
              isSelected
                ? "shadow-md"
                : "bg-background hover:bg-accent hover:text-accent-foreground",
            )}
            onClick={() => onChange(option.value)}
            disabled={disabled}
          >
            <div className="flex flex-col items-start text-left">
              <span>{option.label}</span>
              {option.description && (
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              )}
            </div>
          </Button>
        )
      })}
    </div>
  )
}



