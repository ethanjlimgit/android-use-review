"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { signOut } from "next-auth/react"
import { Button } from "@droiduse/shared-ui/button"
import {
  LayoutDashboard,
  FolderKanban,
  LogOut,
  Mail,
  Users,
  Send,
  BookUser,
  Filter,
  Settings,
  ChevronLeft,
  Loader2,
} from "lucide-react"

const topNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
]

function useProjectId() {
  const pathname = usePathname()
  const match = pathname.match(/^\/dashboard\/projects\/([^/]+)/)
  if (match && match[1] !== "new") return match[1]
  return null
}

function Sidebar() {
  const pathname = usePathname()
  const projectId = useProjectId()

  const { data: project, isLoading } = useQuery<{
    id: string
    name: string
    slug: string
  }>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/internal/projects/${projectId}`)
      if (!res.ok) throw new Error("Failed to fetch project")
      return res.json()
    },
    enabled: !!projectId,
  })

  const projectNavItems = projectId
    ? [
        {
          label: "Overview",
          href: `/dashboard/projects/${projectId}`,
          icon: LayoutDashboard,
          exact: true,
        },
        {
          label: "Contacts",
          href: `/dashboard/projects/${projectId}/contacts`,
          icon: Users,
        },
        {
          label: "Campaigns",
          href: `/dashboard/projects/${projectId}/campaigns`,
          icon: Send,
        },
        {
          label: "Contact Lists",
          href: `/dashboard/projects/${projectId}/contacts/lists`,
          icon: BookUser,
        },
        {
          label: "Segments",
          href: `/dashboard/projects/${projectId}/segments`,
          icon: Filter,
        },
        {
          label: "Settings",
          href: `/dashboard/projects/${projectId}/settings`,
          icon: Settings,
        },
      ]
    : null

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col min-h-screen">
      <div className="p-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Email Service</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {/* Top-level nav */}
        {topNavItems.map((item) => {
          const Icon = item.icon
          const isActive = projectId
            ? false
            : pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}

        {/* Project sub-nav */}
        {projectNavItems && (
          <>
            <div className="pt-4 pb-2">
              <Link
                href="/dashboard/projects"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-3 w-3" />
                All Projects
              </Link>
              <div className="mt-2 px-3">
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <div className="text-sm font-semibold truncate">
                      {project?.name ?? "Project"}
                    </div>
                    {project?.slug && (
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {project.slug}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-border my-2" />

            {projectNavItems.map((item) => {
              const Icon = item.icon
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/")

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  )
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
