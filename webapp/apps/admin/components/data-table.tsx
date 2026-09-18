"use client"

import { useState, useMemo } from "react"
import { Input } from "@droiduse/shared-ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@droiduse/shared-ui/table"
import { Button } from "@droiduse/shared-ui/button"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"

interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  sortable?: boolean
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchable?: boolean
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  filterable?: boolean
  filters?: {
    key: string
    label: string
    options: { value: string; label: string }[]
  }[]
  onFilterChange?: (filters: Record<string, string>) => void
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
  }
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchable = true,
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  filterable = false,
  filters = [],
  onFilterChange,
  pagination,
}: DataTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState("")
  const search = searchValue !== undefined ? searchValue : internalSearch
  const setSearch = onSearchChange || setInternalSearch
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})

  const filteredData = useMemo(() => {
    // When server-side pagination is active, skip client-side filtering
    if (pagination) return data

    let result = data

    if (search && searchable) {
      result = result.filter((item) =>
        Object.values(item).some((value) =>
          String(value).toLowerCase().includes(search.toLowerCase())
        )
      )
    }

    if (filterable && Object.keys(activeFilters).length > 0) {
      result = result.filter((item) => {
        return Object.entries(activeFilters).every(([key, value]) => {
          if (!value) return true
          return String(item[key]) === value
        })
      })
    }

    return result
  }, [data, search, activeFilters, searchable, filterable, pagination])

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...activeFilters, [key]: value }
    setActiveFilters(newFilters)
    onFilterChange?.(newFilters)
  }

  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.pageSize)
    : 1

  return (
    <div className="space-y-4">
      {(searchable || filterable) && (
        <div className="flex flex-col sm:flex-row gap-4">
          {searchable && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  // Trigger search in parent component if needed
                }}
                className="pl-10"
              />
            </div>
          )}
          {filterable && filters.map((filter) => (
            <select
              key={filter.key}
              value={activeFilters[filter.key] || ""}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All {filter.label}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8 text-muted-foreground"
                >
                  No data found
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {column.render
                        ? column.render(item)
                        : String(item[column.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{" "}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)}{" "}
            of {pagination.total} results
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

