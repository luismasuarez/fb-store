"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import type { Group, CreateGroupInput, UpdateGroupInput } from "../../lib/api";

interface GroupFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: Group | null;
  onSubmit: (data: CreateGroupInput | UpdateGroupInput) => Promise<void>;
}

export function GroupForm({ open, onOpenChange, group, onSubmit }: GroupFormProps) {
  const isEdit = !!group;
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [maxPosts, setMaxPosts] = useState("30");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (group) {
        setId(group.id);
        setName(group.name);
        setUrl(group.url ?? "");
        setMaxPosts(String(group.maxPosts));
        setIsActive(group.isActive);
      } else {
        setId("");
        setName("");
        setUrl("");
        setMaxPosts("30");
        setIsActive(true);
      }
      setError("");
    }
  }, [open, group]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isEdit) {
        await onSubmit({
          name,
          url: url || undefined,
          maxPosts: parseInt(maxPosts, 10) || undefined,
          isActive,
        } as UpdateGroupInput);
      } else {
        await onSubmit({
          id,
          name,
          url,
          maxPosts: parseInt(maxPosts, 10) || 30,
          isActive,
        } as CreateGroupInput);
      }
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar grupo" : "Crear grupo"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica los campos del grupo existente"
              : "Completa los campos para crear un nuevo grupo de Facebook"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div className="space-y-2">
              <label htmlFor="id" className="text-sm font-medium">ID</label>
              <Input
                id="id"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="group-123"
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Nombre</label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ventas La Habana"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="url" className="text-sm font-medium">URL</label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://facebook.com/groups/..."
              required={!isEdit}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="maxPosts" className="text-sm font-medium">Max posts</label>
            <Input
              id="maxPosts"
              type="number"
              min={1}
              value={maxPosts}
              onChange={(e) => setMaxPosts(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="isActive" className="text-sm font-medium">
              Activo
            </label>
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear grupo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
