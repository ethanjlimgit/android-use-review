"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Button } from "@droiduse/shared-ui/button"
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  BookOpen,
  Settings,
  LogOut,
  Server,
  ListChecks,
  ClipboardList,
} from "lucide-react"
import { cn } from "@droiduse/shared-ui"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/blog", label: "Blog Posts", icon: FileText },
  { href: "/users", label: "Users", icon: Users },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/survey", label: "Survey Analytics", icon: ClipboardList },
  { href: "/apps", label: "Apps", icon: Package },
  { href: "/skills", label: "Skills", icon: BookOpen },
  { href: "/agents", label: "Agent Servers", icon: Server },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-card border-r border-border min-h-screen p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin CMS</h1>
        <p className="text-sm text-muted-foreground">Droid Use</p>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <Button
        variant="outline"
        className="w-full justify-start gap-3"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="h-5 w-5" />
        <span>Sign Out</span>
      </Button>
    </aside>
  )
}

