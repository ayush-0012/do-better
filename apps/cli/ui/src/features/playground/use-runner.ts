import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRunnerStatus, runQueryKey, runnerQueryKey, startRun } from "@/lib/local-api";
import type { EngineParams } from "@/lib/run-types";

export function useRunnerStatus() {
  return useQuery({
    queryKey: runnerQueryKey,
    queryFn: getRunnerStatus,
    refetchInterval: (query) => (query.state.data?.state === "running" ? 1000 : false),
    refetchOnWindowFocus: true,
  });
}

export function useStartRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: EngineParams) => startRun(params),
    onSuccess: (run) => {
      queryClient.setQueryData(runQueryKey(run.result.id), run);
      void queryClient.invalidateQueries({ queryKey: runnerQueryKey });
    },
  });
}
