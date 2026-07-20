import {
  LayoutDashboard,
  Users,
  List,
  FileText,
  Activity,
  Home,
  Settings,
  type LucideProps,
} from "@/lib/icon"
import type { FC } from "react"

export interface NavItem {
  href: string
  label: string
  icon: FC<LucideProps>
}

export const navItems: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Users },
  { href: "/groups", label: "Groups", icon: List },
  { href: "/listings", label: "Listings", icon: Home },
  { href: "/logs", label: "Scrape Logs", icon: FileText },
  { href: "/schedule", label: "Schedule", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function getPageLabel(pathname: string): string {
  const p = pathname.split("?")[0]
  const exact = navItems.find((n) => n.href === p)
  if (exact) return exact.label
  const prefix = navItems.find((n) => n.href !== "/" && p.startsWith(n.href + "/"))
  return prefix?.label ?? "Dashboard"
}
