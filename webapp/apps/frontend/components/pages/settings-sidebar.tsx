"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@droiduse/shared-ui/utils"
import { User, KeyRound, CreditCard, Gift } from "lucide-react"

const menuItems = [
  {
    title: "Profile",
    href: "/settings",
    icon: User,
  },
  {
    title: "Account",
    href: "/settings/account",
    icon: KeyRound,
  },
  {
    title: "Subscription",
    href: "/settings/subscription",
    icon: CreditCard,
  },
  {
    title: "Referrals",
    href: "/settings/referrals",
    icon: Gift,
  },
]

export function SettingsSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 shrink-0">
      <nav className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href === "/settings" && pathname === "/settings")
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

