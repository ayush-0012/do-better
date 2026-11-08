import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  accountQueryKey,
  getAccount,
  getPendingUploads,
  pendingUploadsQueryKey,
  retryPendingUploads,
  retryRunUpload,
  runQueryKey,
  savedRunsRootQueryKey,
  signIn,
  setupOwner,
  getSetupStatus,
  signOut,
} from "@/lib/local-api";

export function useAccount() {
  return useQuery({
    queryKey: accountQueryKey,
    queryFn: getAccount,
    refetchInterval: (query) => {
      return query.state.data?.state === "checking" ? 1000 : false;
    },
    refetchOnWindowFocus: true,
  });
}

export function usePendingUploads() {
  return useQuery({
    queryKey: pendingUploadsQueryKey,
    queryFn: getPendingUploads,
    refetchOnWindowFocus: true,
  });
}

export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) => signIn(username, password),
    onSuccess: ({ account }) => {
      queryClient.setQueryData(accountQueryKey, account);
      void queryClient.invalidateQueries({ queryKey: ["owner-setup"] });
      void queryClient.invalidateQueries({ queryKey: pendingUploadsQueryKey });
      void queryClient.invalidateQueries({ queryKey: savedRunsRootQueryKey });
    },
  });
}

export function useSetupOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) => setupOwner(username, password),
    onError: () => { void queryClient.invalidateQueries({ queryKey: ["owner-setup"] }); },
    onSuccess: ({ account }) => {
      queryClient.setQueryData(accountQueryKey, account);
      void queryClient.invalidateQueries({ queryKey: ["owner-setup"] });
      void queryClient.invalidateQueries({ queryKey: pendingUploadsQueryKey });
      void queryClient.invalidateQueries({ queryKey: savedRunsRootQueryKey });
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    onSuccess: ({ account }) => {
      queryClient.setQueryData(accountQueryKey, account);
      void queryClient.invalidateQueries({ queryKey: ["owner-setup"] });
      void queryClient.invalidateQueries({ queryKey: pendingUploadsQueryKey });
      void queryClient.invalidateQueries({ queryKey: savedRunsRootQueryKey });
    },
  });
}

export function useSetupStatus(enabled: boolean) {
  return useQuery({ queryKey: ["owner-setup"], queryFn: getSetupStatus, enabled, refetchOnWindowFocus: true });
}

export function useRetryPendingUploads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryPendingUploads,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pendingUploadsQueryKey });
      void queryClient.invalidateQueries({ queryKey: accountQueryKey });
      void queryClient.invalidateQueries({ queryKey: savedRunsRootQueryKey });
    },
  });
}

export function useRetryRunUpload(runId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => retryRunUpload(runId),
    onSuccess: (upload) => {
      queryClient.setQueryData(runQueryKey(runId), (current: { run: unknown; upload: unknown } | undefined) =>
        current ? { ...current, upload } : current,
      );
      void queryClient.invalidateQueries({ queryKey: pendingUploadsQueryKey });
      void queryClient.invalidateQueries({ queryKey: accountQueryKey });
      void queryClient.invalidateQueries({ queryKey: savedRunsRootQueryKey });
    },
  });
}
