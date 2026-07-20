import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Clock, AlertCircle, ArrowRight, CheckCircle, XCircle } from "@/lib/icon"
import { api } from "@/lib/api"
import type { ScrapeLog } from "@/lib/types"

export default function RecentScrapes() {
  const [logs, setLogs] = useState<ScrapeLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.logs.list()
      .then((data) => setLogs(data))
      .catch((err) => { setError(err.message); setLogs([]) })
  }, [])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-heading">
            <Clock className="h-4 w-4 text-primary" />
            Recent Activity
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
            <a href="/logs">
              View all
              <ArrowRight className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {!logs ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-2 w-2 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No scrape activity yet.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[7px] top-2 h-[calc(100%-24px)] w-px bg-border" />
            <div className="space-y-0">
              {logs.slice(0, 8).map((l, i) => (
                <div key={l.id} className="relative flex gap-3 pb-4 last:pb-0">
                  <div className="relative z-10 mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    {l.postsErrors > 0 ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : l.postsNew > 0 ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{l.groupId}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {new Date(l.startedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-emerald-500">{l.postsNew} new</span>
                      <span className="mx-1">·</span>
                      {l.postsFound} found
                      <span className="mx-1">·</span>
                      {l.durationMs ? `${(l.durationMs / 1000).toFixed(1)}s` : "—"}
                      {l.postsErrors > 0 && (
                        <>
                          <span className="mx-1">·</span>
                          <span className="text-red-500">{l.postsErrors} errors</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
