import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, List, FileText, Clock } from "@/lib/icon"
import { api } from "@/lib/api"


interface Stats {
  accounts: number
  groups: number
  posts: number
  lastScrape: string | null
}

export default function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    Promise.all([api.profiles.list(), api.groups.list()])
      .then(([profiles, groups]) => {
        setStats({
          accounts: profiles.length,
          groups: groups.length,
          posts: 0,
          lastScrape: null,
        })
      })
      .catch(() => {})
  }, [])

  const items = [
    { label: "Accounts", value: stats?.accounts, icon: Users },
    { label: "Groups", value: stats?.groups, icon: List },
    { label: "Posts Scraped", value: stats?.posts, icon: FileText },
    { label: "Last Scrape", value: stats?.lastScrape ?? "—", icon: Clock },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <item.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              {stats ? (
                <p className="text-xl font-semibold tracking-tight">{item.value ?? "—"}</p>
              ) : (
                <Skeleton className="mt-1 h-5 w-12" />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
