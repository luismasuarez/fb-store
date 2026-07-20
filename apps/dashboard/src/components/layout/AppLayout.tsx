import type { ReactNode } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import AppSidebar from "@/components/layout/AppSidebar"
import ThemeToggle from "@/components/layout/ThemeToggle"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex min-h-svh w-full flex-col">
        <header className="flex h-14 items-center justify-end gap-4 border-b border-sidebar-border px-6">
          <ThemeToggle />
        </header>
        <div className="flex-1 p-6">{children}</div>
      </main>
      <Toaster />
    </SidebarProvider>
  )
}
