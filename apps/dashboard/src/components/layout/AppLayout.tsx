import type { ReactNode } from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import AppSidebar from "@/components/layout/AppSidebar"
import ThemeToggle from "@/components/layout/ThemeToggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useLocation } from "@/lib/use-location"
import { getPageLabel } from "@/lib/nav"

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useLocation()
  const currentLabel = getPageLabel(pathname)
  const isHome = pathname === "/"

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex min-h-svh w-full flex-col">
        <header className="flex h-14 items-center gap-4 border-b border-sidebar-border px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                {!isHome && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <ThemeToggle />
        </header>
        <div className="flex-1 space-y-8 p-6 lg:p-8">{children}</div>
      </main>
      <Toaster />
    </SidebarProvider>
  )
}
