"use client"

import { useRef, useEffect, useState } from "react"

interface EmailPreviewProps {
  html: string
  subject?: string
  preheader?: string
  fromName?: string
  fromEmail?: string
  height?: number
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const GMAIL_RESETS = `
  body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #222; background: #fff; word-wrap: break-word; }
  img { max-width: 100%; height: auto; }
  a { color: #1a73e8; }
  table { border-collapse: collapse; }
  h1, h2, h3, h4, h5, h6 { margin: 0.67em 0; }
`

export function EmailPreview({
  html,
  subject,
  preheader,
  fromName = "Sender",
  fromEmail = "sender@example.com",
  height = 500,
}: EmailPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        if (html) {
          doc.write(
            `<!DOCTYPE html><html><head><style>${GMAIL_RESETS}</style></head><body>${html}</body></html>`
          )
        } else {
          doc.write(
            `<p style="color: #999; padding: 20px; font-family: Arial, sans-serif;">No content to preview</p>`
          )
        }
        doc.close()
      }
    }
  }, [html])

  const containerWidth = device === "mobile" ? 375 : 600

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Device toggle */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30">
        <button
          type="button"
          onClick={() => setDevice("desktop")}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            device === "desktop"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Desktop
        </button>
        <button
          type="button"
          onClick={() => setDevice("mobile")}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            device === "mobile"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Mobile
        </button>
      </div>

      {/* Gmail chrome */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ background: "#fff" }}>
        {subject && (
          <h2
            className="text-lg font-normal mb-3"
            style={{ color: "#202124" }}
          >
            {subject}
          </h2>
        )}
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
            style={{ backgroundColor: "#1a73e8" }}
          >
            {getInitials(fromName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span
                className="font-medium text-sm"
                style={{ color: "#202124" }}
              >
                {fromName}
              </span>
              <span className="text-xs" style={{ color: "#5f6368" }}>
                &lt;{fromEmail}&gt;
              </span>
            </div>
            <div className="text-xs" style={{ color: "#5f6368" }}>
              to me
            </div>
          </div>
          <span className="text-xs flex-shrink-0" style={{ color: "#5f6368" }}>
            12:00 PM
          </span>
        </div>
      </div>

      {/* Email body iframe */}
      <div
        className="flex justify-center bg-white overflow-auto"
        style={{ padding: "16px 0" }}
      >
        <div style={{ width: containerWidth, maxWidth: "100%" }}>
          <iframe
            ref={iframeRef}
            title="Email preview"
            className="w-full border-0"
            style={{ height: `${height}px` }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  )
}
