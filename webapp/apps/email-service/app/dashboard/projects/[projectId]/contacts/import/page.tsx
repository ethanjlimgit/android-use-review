"use client"

import { useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@droiduse/shared-ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@droiduse/shared-ui/card"
import { Label } from "@droiduse/shared-ui/label"
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react"

const CONTACT_FIELDS = [
  { value: "", label: "-- Skip --" },
  { value: "email", label: "Email" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "jobTitle", label: "Job Title" },
  { value: "timezone", label: "Timezone" },
  { value: "country", label: "Country" },
  { value: "city", label: "City" },
  { value: "source", label: "Source" },
  { value: "externalId", label: "External ID" },
]

export default function ImportContactsPage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const projectId = params.projectId
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvPreview, setCsvPreview] = useState<string[][]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError(null)
    setSuccess(false)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split("\n").filter((line) => line.trim())
      if (lines.length === 0) {
        setError("CSV file is empty")
        return
      }

      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""))
      setCsvHeaders(headers)

      // Preview first 3 data rows
      const preview = lines
        .slice(1, 4)
        .map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")))
      setCsvPreview(preview)

      // Auto-map columns by common names
      const autoMapping: Record<string, string> = {}
      headers.forEach((header) => {
        const lower = header.toLowerCase()
        if (lower.includes("email")) autoMapping[header] = "email"
        else if (lower.includes("first") && lower.includes("name"))
          autoMapping[header] = "firstName"
        else if (lower.includes("last") && lower.includes("name"))
          autoMapping[header] = "lastName"
        else if (lower.includes("phone")) autoMapping[header] = "phone"
        else if (lower.includes("company") || lower.includes("organization") || lower.includes("org"))
          autoMapping[header] = "company"
        else if (lower.includes("job") || lower.includes("title") || lower.includes("role") || lower.includes("position"))
          autoMapping[header] = "jobTitle"
        else if (lower.includes("timezone") || lower === "tz")
          autoMapping[header] = "timezone"
        else if (lower.includes("country")) autoMapping[header] = "country"
        else if (lower.includes("city")) autoMapping[header] = "city"
        else if (lower.includes("source")) autoMapping[header] = "source"
      })
      setColumnMapping(autoMapping)
    }
    reader.readAsText(selectedFile)
  }

  function updateMapping(csvColumn: string, contactField: string) {
    setColumnMapping((prev) => {
      const updated = { ...prev }
      if (contactField) {
        updated[csvColumn] = contactField
      } else {
        delete updated[csvColumn]
      }
      return updated
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    const hasEmail = Object.values(columnMapping).includes("email")
    if (!hasEmail) {
      setError("You must map at least one column to 'Email'")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("columnMapping", JSON.stringify(columnMapping))

      const res = await fetch(
        `/api/internal/projects/${projectId}/contacts/import`,
        {
          method: "POST",
          body: formData,
        }
      )

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Import failed")
        return
      }

      setSuccess(true)
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  function clearFile() {
    setFile(null)
    setCsvHeaders([])
    setCsvPreview([])
    setColumnMapping({})
    setSuccess(false)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/projects/${projectId}/contacts`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Import Contacts</h1>
          <p className="text-muted-foreground text-sm">
            Upload a CSV file to import contacts
          </p>
        </div>
      </div>

      {success ? (
        <Card className="border-card-border">
          <CardContent className="flex flex-col items-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Import Started</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your contacts are being imported. This may take a few moments.
            </p>
            <div className="flex gap-3">
              <Link href={`/dashboard/projects/${projectId}/contacts`}>
                <Button>View Contacts</Button>
              </Link>
              <Button variant="outline" onClick={clearFile}>
                Import More
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
              {error}
            </div>
          )}

          {/* File Upload */}
          <Card className="border-card-border">
            <CardHeader>
              <CardTitle className="text-base">Upload CSV File</CardTitle>
            </CardHeader>
            <CardContent>
              {!file ? (
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    CSV files only
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {csvHeaders.length} columns detected
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={clearFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Column Mapping */}
          {csvHeaders.length > 0 && (
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle className="text-base">Column Mapping</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Map CSV columns to contact fields
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {csvHeaders.map((header) => (
                  <div
                    key={header}
                    className="flex items-center gap-4"
                  >
                    <div className="w-1/3">
                      <Label className="text-sm font-mono">{header}</Label>
                      {csvPreview[0] && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          e.g.{" "}
                          {csvPreview[0][csvHeaders.indexOf(header)] || "--"}
                        </p>
                      )}
                    </div>
                    <div className="flex-1">
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={columnMapping[header] || ""}
                        onChange={(e) =>
                          updateMapping(header, e.target.value)
                        }
                      >
                        {CONTACT_FIELDS.map((field) => (
                          <option key={field.value} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Submit */}
          {csvHeaders.length > 0 && (
            <div className="flex gap-3">
              <Button type="submit" disabled={loading || !file}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Start Import
              </Button>
              <Button type="button" variant="outline" onClick={clearFile}>
                Cancel
              </Button>
            </div>
          )}
        </form>
      )}
    </div>
  )
}
