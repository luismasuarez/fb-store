import { useScrape, useAiProcess } from "../../hooks/use-scrape";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function ScrapeControls() {
  const { mutate, isPending, isError, error, sse } = useScrape();
  const aiMutation = useAiProcess();

  const isRunning = isPending || sse.status === "running";
  const progressPct = sse.total > 0 ? Math.round((sse.current / sse.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Controles operativos</CardTitle>
        <CardDescription>
          Dispara acciones manuales de scraping y procesamiento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => mutate()} disabled={isRunning}>
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
            Error: {error?.message || sse.error || "Error al scrapear"}
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
