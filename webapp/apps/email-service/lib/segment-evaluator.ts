import type { SegmentFilter } from "./schemas"

/**
 * Converts a JSON filter array to a Prisma `where` clause for querying contacts.
 * Always adds base conditions: emailUnsubscribed = false.
 */
export function buildContactWhereFromFilters(
  projectId: string,
  filters: SegmentFilter[]
): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = []

  for (const filter of filters) {
    const condition = buildCondition(filter)
    if (condition) {
      conditions.push(condition)
    }
  }

  return {
    AND: [
      { projectId },
      { emailUnsubscribed: false },
      ...conditions,
    ],
  }
}

function buildCondition(filter: SegmentFilter): Record<string, unknown> | null {
  const { field, operator, value } = filter

  // Handle metadata.* fields by using JSON path queries
  if (field.startsWith("metadata.")) {
    const jsonPath = field.replace("metadata.", "")
    return {
      metadata: {
        path: [jsonPath],
        ...getOperatorClause(operator, value),
      },
    }
  }

  switch (operator) {
    case "equals":
      return { [field]: { equals: value } }
    case "not_equals":
      return { [field]: { not: value } }
    case "in":
      return { [field]: { in: Array.isArray(value) ? value : [value] } }
    case "not_in":
      return { [field]: { notIn: Array.isArray(value) ? value : [value] } }
    case "contains":
      return { [field]: { contains: String(value), mode: "insensitive" } }
    case "gt":
      return { [field]: { gt: value } }
    case "lt":
      return { [field]: { lt: value } }
    case "gte":
      return { [field]: { gte: value } }
    case "lte":
      return { [field]: { lte: value } }
    default:
      return null
  }
}

function getOperatorClause(operator: string, value: unknown): Record<string, unknown> {
  switch (operator) {
    case "equals":
      return { equals: value }
    case "not_equals":
      return { not: value }
    case "contains":
      return { string_contains: String(value) }
    case "gt":
      return { gt: value }
    case "lt":
      return { lt: value }
    case "gte":
      return { gte: value }
    case "lte":
      return { lte: value }
    default:
      return { equals: value }
  }
}
