import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRunnerStatus, pendingUploadsQueryKey, runQueryKey, runnerQueryKey, savedRunsRootQueryKey, startRun } from "@/lib/local-api";
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
    onSuccess: (payload) => {
      queryClient.setQueryData(runQueryKey(payload.run.result.id), payload);
      void queryClient.invalidateQueries({ queryKey: runnerQueryKey });
      void queryClient.invalidateQueries({ queryKey: pendingUploadsQueryKey });
      void queryClient.invalidateQueries({ queryKey: savedRunsRootQueryKey });
    },
  });
}
