"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import type { SegmentFilter } from "../types"

export interface FieldOption {
  value: string
  label: string
}

const DEFAULT_FIELD_OPTIONS: FieldOption[] = [
  { value: "email", label: "Email" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "country", label: "Country" },
  { value: "city", label: "City" },
  { value: "timezone", label: "Timezone" },
  { value: "source", label: "Source" },
]

const OPERATOR_OPTIONS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "in", label: "in (comma-separated)" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "gte", label: "greater or equal" },
  { value: "lte", label: "less or equal" },
]

interface SegmentBuilderProps {
  filters: SegmentFilter[]
  onChange: (filters: SegmentFilter[]) => void
  fieldOptions?: FieldOption[]
}

export function SegmentBuilder({ filters, onChange, fieldOptions }: SegmentBuilderProps) {
  const fields = fieldOptions || DEFAULT_FIELD_OPTIONS

  const addFilter = () => {
    onChange([...filters, { field: fields[0]?.value || "email", operator: "equals", value: "" }])
  }

  const updateFilter = (index: number, updates: Partial<SegmentFilter>) => {
    const updated = filters.map((f, i) => (i === index ? { ...f, ...updates } : f))
    onChange(updated)
  }

  const removeFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {filters.map((filter, index) => (
        <div key={index} className="flex items-center gap-2">
          <select
            value={filter.field}
            onChange={(e) => updateFilter(index, { field: e.target.value })}
            className="px-3 py-2 border rounded-md bg-background text-sm"
          >
            {fields.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={filter.operator}
            onChange={(e) => updateFilter(index, { operator: e.target.value as SegmentFilter["operator"] })}
            className="px-3 py-2 border rounded-md bg-background text-sm"
          >
            {OPERATOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            value={String(filter.value ?? "")}
            onChange={(e) => updateFilter(index, { value: e.target.value })}
            placeholder="Value..."
            className="flex-1 px-3 py-2 border rounded-md bg-background text-sm"
          />
          <button
            onClick={() => removeFilter(index)}
            className="p-2 rounded-md hover:bg-muted"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        onClick={addFilter}
        className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-muted"
        type="button"
      >
        <Plus className="h-4 w-4" />
        Add Filter
      </button>
    </div>
  )
}
