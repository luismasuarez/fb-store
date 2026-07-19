import { useScrape, useAiProcess } from "../../hooks/use-scrape";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export function ScrapeControls() {
  const scrapeMutation = useScrape();
  const aiMutation = useAiProcess();

  const isRunning = scrapeMutation.isPending || aiMutation.isPending;

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
          <Button
            onClick={() => scrapeMutation.mutate()}
            disabled={isRunning}
          >
            {scrapeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scrapeando...
              </>
            ) : (
              "Scrapear ahora"
            )}
          </Button>

          <Button
            onClick={() => aiMutation.mutate()}
            disabled={isRunning}
            variant="secondary"
          >
            {aiMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              "Procesar con IA"
            )}
          </Button>
        </div>

        {scrapeMutation.isSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Scrape completado exitosamente
          </div>
        )}

        {aiMutation.isSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Procesamiento completado exitosamente
          </div>
        )}

        {scrapeMutation.isError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Error: {(scrapeMutation.error as Error)?.message || "Error al scrapear"}
          </div>
        )}

        {aiMutation.isError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Error: {(aiMutation.error as Error)?.message || "Error al procesar"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
