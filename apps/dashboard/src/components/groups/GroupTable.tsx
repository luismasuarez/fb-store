import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil, RefreshCw } from "@/lib/icon"
import { api, extractGroupId } from "@/lib/api"
import { toast } from "sonner"
import StatusBadge from "@/components/shared/StatusBadge"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import type { Group } from "@/lib/types"

export default function GroupTable() {
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Group | null>(null)
  const [url, setUrl] = useState("")
  const [name, setName] = useState("")
  const [maxPosts, setMaxPosts] = useState(30)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null)
  const [scrapingId, setScrapingId] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<string[]>([])

  function load() {
    api.groups.list().then(setGroups).catch(() => setGroups([]))
    api.profiles.list().then((p) => setProfiles(p.map((x) => x.name))).catch(() => {})
  }

  useEffect(load, [])

  function openCreate() {
    setEditing(null)
    setUrl("")
    setName("")
    setMaxPosts(30)
    setDialogOpen(true)
  }

  function openEdit(g: Group) {
    setEditing(g)
    setUrl("")
    setName(g.name)
    setMaxPosts(g.maxPosts)
    setDialogOpen(true)
  }

  async function save() {
    const id = editing ? editing.id : extractGroupId(url)
    if (!id) { toast.error("Invalid Facebook group URL"); return }
    setSaving(true)
    try {
      if (editing) {
        await api.groups.update(id, { name: name || id, maxPosts })
        toast.success("Group updated")
      } else {
        await api.groups.create({ id, name: name || id, url, maxPosts })
        toast.success("Group created")
      }
      setDialogOpen(false)
      load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await api.groups.remove(deleteTarget.id)
      setDeleteTarget(null)
      load()
      toast.success("Group deleted")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function scrapeGroup(g: Group) {
    if (profiles.length === 0) { toast.error("No accounts available"); return }
    setScrapingId(g.id)
    try {
      const r = await api.scrape.run({ groupId: g.id, maxPosts: g.maxPosts, profile: profiles[0] })
      toast.success(`Scraped ${r.metrics.postsNew} new posts from "${g.name}"`)
      load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setScrapingId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-heading">
              <RefreshCw className="h-4 w-4 text-primary" />
              Saved Groups
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false) }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="mr-1 h-4 w-4" />
                  New Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Group" : "Create Group"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {!editing && (
                    <div className="space-y-2">
                      <Label htmlFor="gurl">Facebook Group URL</Label>
                      <Input id="gurl" placeholder="https://facebook.com/groups/..." value={url} onChange={(e) => setUrl(e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="gname">Name</Label>
                    <Input id="gname" placeholder="My Group" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gmax">Max Posts</Label>
                    <Input id="gmax" type="number" min={1} max={200} value={maxPosts} onChange={(e) => setMaxPosts(Number(e.target.value))} />
                  </div>
                  <Button onClick={save} disabled={saving} className="w-full">
                    {saving ? "Saving..." : editing ? "Update" : "Create"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {!groups ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No groups yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Group ID</TableHead>
                  <TableHead>Max Posts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Scraped</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{g.id}</TableCell>
                    <TableCell>{g.maxPosts}</TableCell>
                    <TableCell><StatusBadge status={g.isActive ? "active" : "inactive"} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {g.lastScraped ? new Date(g.lastScraped).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => scrapeGroup(g)}
                          disabled={scrapingId === g.id}
                        >
                          <RefreshCw className={`mr-1 h-3 w-3 ${scrapingId === g.id ? "animate-spin" : ""}`} />
                          Scrape
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(g)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-500"
                          onClick={() => setDeleteTarget(g)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="Delete Group"
        description={`Delete group "${deleteTarget?.name}"?`}
        onConfirm={confirmDelete}
      />
    </>
  )
}
