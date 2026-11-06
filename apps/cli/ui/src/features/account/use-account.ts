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
  signUp,
  signOut,
  startOAuth,
} from "@/lib/local-api";

export function useAccount(pollForOAuth = false) {
  return useQuery({
    queryKey: accountQueryKey,
    queryFn: getAccount,
    refetchInterval: (query) => {
      if (pollForOAuth) return query.state.data?.state === "signed_in" ? false : 2000;
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
    mutationFn: ({ email, password }: { email: string; password: string }) => signIn(email, password),
    onSuccess: ({ account }) => {
      queryClient.setQueryData(accountQueryKey, account);
      void queryClient.invalidateQueries({ queryKey: pendingUploadsQueryKey });
      void queryClient.invalidateQueries({ queryKey: savedRunsRootQueryKey });
    },
  });
}

export function useSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, email, password }: { name: string; email: string; password: string }) => signUp(name, email, password),
    onSuccess: ({ account }) => {
      queryClient.setQueryData(accountQueryKey, account);
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
      void queryClient.invalidateQueries({ queryKey: pendingUploadsQueryKey });
      void queryClient.invalidateQueries({ queryKey: savedRunsRootQueryKey });
    },
  });
}

export function useStartOAuth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: "google" | "github") => startOAuth(provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountQueryKey });
    },
  });
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
