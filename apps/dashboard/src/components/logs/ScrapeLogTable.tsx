import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText } from "@/lib/icon"
import type { ScrapeLog } from "@/lib/types"

export default function ScrapeLogTable() {
  const [logs, setLogs] = useState<ScrapeLog[] | null>(null)

  useEffect(() => {
    fetch("/api/v1/scrape-logs")
      .then((r) => r.json())
      .then((d) => setLogs((d.data ?? d) ?? []))
      .catch(() => setLogs([]))
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-heading">
          <FileText className="h-4 w-4 text-primary" />
          All Scrape Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!logs ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No scrape logs yet. Run a scrape to see results here.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Found</TableHead>
                <TableHead>New</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.groupId}</TableCell>
                  <TableCell>{l.postsFound}</TableCell>
                  <TableCell><span className="text-emerald-500">{l.postsNew}</span></TableCell>
                  <TableCell>{l.postsErrors > 0 ? <span className="text-red-500">{l.postsErrors}</span> : "0"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {l.durationMs ? `${(l.durationMs / 1000).toFixed(1)}s` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(l.startedAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
