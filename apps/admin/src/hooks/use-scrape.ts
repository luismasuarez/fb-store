import { useMutation } from "@tanstack/react-query";
import { triggerScrape, triggerAiProcess } from "@/lib/api";

export function useScrape() {
  return useMutation({
    mutationFn: () => triggerScrape(),
  });
}

export function useAiProcess() {
  return useMutation({
    mutationFn: () => triggerAiProcess(),
  });
}
