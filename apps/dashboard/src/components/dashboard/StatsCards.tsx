import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, List, Clock } from "@/lib/icon"
import { api } from "@/lib/api"

interface Stats {
  accounts: number
  groups: number
}

export default function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    Promise.all([api.profiles.list(), api.groups.list()])
      .then(([profiles, groups]) => setStats({ accounts: profiles.length, groups: groups.length }))
      .catch(() => {})
  }, [])

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Accounts"
        value={stats?.accounts}
        icon={Users}
        loading={!stats}
        color="text-primary"
      />
      <StatCard
        label="Groups"
        value={stats?.groups}
        icon={List}
        loading={!stats}
        color="text-primary"
      />
      <StatCard
        label="Posts Scraped"
        value={null}
        icon={Clock}
        loading={false}
        color="text-muted-foreground"
        muted
      />
      <StatCard
        label="Last Scrape"
        value={null}
        icon={Clock}
        loading={false}
        color="text-muted-foreground"
        muted
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  color,
  muted,
}: {
  label: string
  value?: number | null
  icon: React.FC<{ className?: string }>
  loading: boolean
  color: string
  muted?: boolean
}) {
  return (
    <Card className={muted ? "opacity-60" : ""}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${muted ? "bg-muted" : "bg-primary/10"}`}>
          <Icon className={`h-5 w-5 ${muted ? "text-muted-foreground" : "text-primary"}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-5 w-12" />
          ) : (
            <p className={`text-xl font-semibold tracking-tight ${color}`}>
              {value !== null && value !== undefined ? value : muted ? "—" : value}
            </p>
          )}
          {muted && (
            <p className="mt-0.5 text-[10px] text-muted-foreground/60">Coming soon</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
