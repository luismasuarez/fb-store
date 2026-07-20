import {
  LayoutDashboard,
  Users,
  List,
  FileText,
  Activity,
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
  { href: "/logs", label: "Scrape Logs", icon: FileText },
  { href: "/schedule", label: "Schedule", icon: Activity },
]

export function getPageLabel(pathname: string): string {
  const item = navItems.find((n) => n.href === pathname)
  return item?.label ?? "Dashboard"
}
