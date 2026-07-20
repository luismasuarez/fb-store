import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { triggerScrape, triggerAiProcess } from "@/lib/api";

interface ScrapeMetrics {
  postsFound?: number;
  postsNew?: number;
  durationMs?: number;
}

export interface ScrapeState {
  status: "idle" | "running" | "complete" | "error";
  phase: string;
  current: number;
  total: number;
  logs: string[];
  metrics: ScrapeMetrics | null;
  error: string | null;
  jobId: string | null;
}

const initialState: ScrapeState = {
  status: "idle",
  phase: "",
  current: 0,
  total: 0,
  logs: [],
  metrics: null,
  error: null,
  jobId: null,
};

export function useScrape() {
  const [sse, setSse] = useState<ScrapeState>(initialState);
  const esRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  const mutation = useMutation({
    mutationFn: (args?: { groupId?: string; maxPosts?: number }) =>
      triggerScrape(args?.groupId, args?.maxPosts),
    onSuccess: (data) => {
      cleanup();
      setSse({ ...initialState, status: "running", jobId: data.jobId });

      const es = new EventSource(`/api/scrape/${data.jobId}/events`);
      esRef.current = es;

      es.addEventListener("progress", (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data);
          setSse((prev) => {
            const phase = d.phase ?? prev.phase;
            const logs =
              phase && phase !== prev.phase
                ? [...prev.logs, `🔄 ${phase} (${d.current ?? prev.current}/${d.total ?? prev.total})`]
                : prev.logs;
            return {
              ...prev,
              phase,
              current: d.current ?? prev.current,
              total: d.total ?? prev.total,
              logs,
            };
          });
        } catch { /* ignore parse errors */ }
      });

      es.addEventListener("log", (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data);
          setSse((prev) => ({
            ...prev,
            logs: [...prev.logs, d.message ?? JSON.stringify(d)],
          }));
        } catch { /* ignore parse errors */ }
      });

      es.addEventListener("complete", (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data);
          setSse((prev) => ({
            ...prev,
            status: "complete",
            metrics: d.metrics ?? null,
            logs: [
              ...prev.logs,
              `✅ Completado: ${d.metrics?.postsFound ?? 0} posts en ${((d.metrics?.durationMs ?? 0) / 1000).toFixed(1)}s`,
            ],
          }));
        } catch { /* ignore parse errors */ }
        cleanup();
      });

      es.addEventListener("error", (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data);
          setSse((prev) => ({
            ...prev,
            status: "error",
            error: d.message ?? "Scrape failed",
          }));
        } catch {
          setSse((prev) => ({
            ...prev,
            status: "error",
            error: "Scrape failed",
          }));
        }
        cleanup();
      });

      es.onerror = () => {
        setSse((prev) => {
          if (prev.status === "running") {
            return { ...prev, status: "error", error: "Conexión perdida" };
          }
          return prev;
        });
        cleanup();
      };
    },
  });

  useEffect(() => cleanup, [cleanup]);

  return { ...mutation, sse };
}

export function useAiProcess() {
  return useMutation({
    mutationFn: () => triggerAiProcess(),
  });
}
