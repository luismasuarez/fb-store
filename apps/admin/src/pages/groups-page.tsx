import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  triggerScrape,
  getJobStatus,
} from "../lib/api";
import type { Group } from "../lib/api";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { GroupForm } from "../components/groups/group-form";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";

export function GroupsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [scrapingGroupId, setScrapingGroupId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => fetchGroups(1, 100),
  });

  const createMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Parameters<typeof updateGroup>[1]) =>
      updateGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  function handleCreate() {
    setEditingGroup(null);
    setFormOpen(true);
  }

  function handleEdit(group: Group) {
    setEditingGroup(group);
    setFormOpen(true);
  }

  async function handleSubmit(data: any) {
    if (editingGroup) {
      await updateMutation.mutateAsync({ id: editingGroup.id, ...data });
    } else {
      await createMutation.mutateAsync(data);
    }
  }

  function handleToggleActive(group: Group) {
    updateMutation.mutate({ id: group.id, isActive: !group.isActive });
  }

  function handleDelete(group: Group) {
    if (window.confirm(`¿Eliminar el grupo "${group.name}"?`)) {
      deleteMutation.mutate(group.id);
    }
  }

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  async function handleScrapeGroup(group: Group) {
    setScrapingGroupId(group.id);
    try {
      const { jobId } = await triggerScrape(group.id, group.maxPosts);

      await new Promise<void>((resolve, reject) => {
        pollingRef.current = setInterval(async () => {
          try {
            const status = await getJobStatus(jobId);
            if (status?.status === "completed" || status?.status === "complete") {
              stopPolling();
              queryClient.invalidateQueries({ queryKey: ["groups"] });
              setScrapingGroupId(null);
              resolve();
            } else if (status?.status === "failed" || status?.status === "error") {
              stopPolling();
              setScrapingGroupId(null);
              reject(new Error(status.failedReason ?? "Scrape failed"));
            }
          } catch {
            stopPolling();
            setScrapingGroupId(null);
            reject(new Error("Error checking scrape status"));
          }
        }, 2000);
      });
    } catch {
      setScrapingGroupId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Grupos de Facebook</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Crear grupo
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Max posts</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último scrape</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay grupos configurados
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {group.url}
                  </TableCell>
                  <TableCell>{group.maxPosts}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggleActive(group)}
                      className="cursor-pointer"
                    >
                      <Badge variant={group.isActive ? "default" : "secondary"}>
                        {group.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {group.lastScraped
                      ? new Date(group.lastScraped).toLocaleString("es-ES")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleScrapeGroup(group)}
                        disabled={scrapingGroupId === group.id || !group.isActive}
                      >
                        {scrapingGroupId === group.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Scrapear"
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(group)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(group)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <GroupForm
        open={formOpen}
        onOpenChange={setFormOpen}
        group={editingGroup}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
