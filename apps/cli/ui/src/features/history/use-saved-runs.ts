import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getSavedRun,
  getSavedRuns,
  getSavedRunsSummary,
  savedRunQueryKey,
  savedRunsQueryKey,
  savedRunsSummaryQueryKey,
  type SavedRunQuery,
} from "@/lib/local-api";

export function useSavedRuns(query: SavedRunQuery, enabled = true) {
  return useQuery({
    queryKey: savedRunsQueryKey(query),
    queryFn: () => getSavedRuns(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useSavedRunsSummary(enabled = true) {
  return useQuery({
    queryKey: savedRunsSummaryQueryKey,
    queryFn: getSavedRunsSummary,
    enabled,
  });
}

export function useSavedRun(runId: string, enabled = true) {
  return useQuery({
    queryKey: savedRunQueryKey(runId),
    queryFn: () => getSavedRun(runId),
    enabled,
    retry: false,
  });
}
