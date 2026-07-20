import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, LogIn, Eye } from "@/lib/icon"
import { api } from "@/lib/api"
import { toast } from "sonner"
import StatusBadge from "@/components/shared/StatusBadge"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import type { Profile } from "@/lib/types"

export default function AccountTable() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)

  function load() {
    api.profiles.list().then(setProfiles).catch(() => setProfiles([]))
  }

  useEffect(load, [])

  async function create() {
    if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
      toast.error("Only letters, numbers, hyphens and underscores")
      return
    }
    setCreating(true)
    try {
      await api.profiles.create(newName)
      setNewName("")
      setDialogOpen(false)
      load()
      toast.success("Account created")
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function checkSession(name: string) {
    try {
      const r = await api.profiles.check(name)
      toast.info(`Session: ${r.alive ? "alive" : "dead"} — ${r.reason}`)
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function loginProfile(name: string) {
    try {
      const r = await api.login.start(name)
      if (r.vncUrl) window.open(r.vncUrl, "_blank", "width=1280,height=800")
      toast.success(`Login started for "${name}"`)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await api.profiles.remove(deleteTarget.name)
      setDeleteTarget(null)
      load()
      toast.success("Account deleted")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-heading">
              <Eye className="h-4 w-4 text-primary" />
              Saved Accounts
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  New Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Account</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Account name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. cuenta-2"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      pattern="^[a-zA-Z0-9_-]+$"
                    />
                  </div>
                  <Button onClick={create} disabled={creating} className="w-full">
                    {creating ? "Creating..." : "Create"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {!profiles ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No accounts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><StatusBadge status={p.loginStatus} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => checkSession(p.name)}>
                          Check
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => loginProfile(p.name)}>
                          <LogIn className="mr-1 h-3 w-3" />
                          Login
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-500"
                          onClick={() => setDeleteTarget(p)}
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
        title="Delete Account"
        description={`Delete account "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={confirmDelete}
      />
    </>
  )
}
