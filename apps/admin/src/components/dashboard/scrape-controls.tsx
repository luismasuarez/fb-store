import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useScrape, useAiProcess } from "../../hooks/use-scrape";
import { fetchGroups, triggerScrapeAllGroups } from "../../lib/api";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

function extractError(err: unknown): string {
  const anyErr = err as Record<string, unknown>;
  const resp = anyErr?.response as Record<string, unknown> | undefined;
  const respData = resp?.data as Record<string, unknown> | undefined;
  return (
    (respData?.error as Record<string, unknown> | undefined)?.message as string
    ?? respData?.message as string
    ?? (anyErr?.message as string)
    ?? "Error al scrapear"
  );
}

export function ScrapeControls() {
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const { mutate, isPending, isError, error, sse } = useScrape();
  const aiMutation = useAiProcess();
  const [allScraping, setAllScraping] = useState(false);
  const [allComplete, setAllComplete] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);

  const { data: groupsData } = useQuery({
    queryKey: ["groups"],
    queryFn: () => fetchGroups(1, 100),
  });

  const activeGroups = groupsData?.data.filter((g) => g.isActive) ?? [];

  const isRunning = isPending || sse.status === "running" || allScraping;
  const progressPct = sse.total > 0 ? Math.round((sse.current / sse.total) * 100) : 0;
  const errorMessage = extractError(error);

  async function handleScrape() {
    if (selectedGroupId) {
      mutate({ groupId: selectedGroupId });
    } else {
      setAllScraping(true);
      setAllComplete(false);
      setAllError(null);
      try {
        await triggerScrapeAllGroups();
        setAllComplete(true);
      } catch (err: any) {
        setAllError(err?.message || "Error scraping all groups");
      } finally {
        setAllScraping(false);
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Controles operativos</CardTitle>
        <CardDescription>
          Dispara acciones manuales de scraping y procesamiento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeGroups.length > 0 && (
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            disabled={isRunning}
            aria-label="Seleccionar grupo"
          >
            <option value="">Todos los grupos</option>
            {activeGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        )}

        {sse.status === "running" && sse.jobId && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Job activo: {sse.jobId.slice(0, 8)}...
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleScrape} disabled={isRunning}>
            {isRunning ? "Scrapeando..." : "Scrapear ahora"}
          </Button>

          <Button
            onClick={() => aiMutation.mutate()}
            disabled={isRunning}
            variant="secondary"
          >
            {aiMutation.isPending ? (
              "Procesando..."
            ) : (
              "Procesar con IA"
            )}
          </Button>
        </div>

        {allScraping && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Scrapeando todos los grupos...</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full animate-pulse rounded-full bg-primary"
                style={{ width: "100%" }}
              />
            </div>
          </div>
        )}

        {sse.status === "running" && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="capitalize">{sse.phase || "Iniciando..."}</span>
              <span>
                {sse.current}/{sse.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.max(progressPct, 5)}%` }}
              />
            </div>
          </div>
        )}

        {sse.logs.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
            {sse.logs.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>
        )}

        {allComplete && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Todos los grupos scrapeados exitosamente
          </div>
        )}

        {allError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Error: {allError}
          </div>
        )}

        {sse.status === "complete" && sse.metrics && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Scrape completado: {sse.metrics.postsFound} posts encontrados en{" "}
            {((sse.metrics.durationMs ?? 0) / 1000).toFixed(1)}s
          </div>
        )}

        {sse.status === "complete" && !sse.metrics && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Scrape completado exitosamente
          </div>
        )}

        {(isError || sse.status === "error") && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Error: {errorMessage || sse.error || "Error al scrapear"}
          </div>
        )}

        {aiMutation.isSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Procesamiento completado exitosamente
          </div>
        )}

        {aiMutation.isError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Error: {(aiMutation.error as Error)?.message || "Error al procesar"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
