import type { AccountService } from "./account.ts";
import type { RunStore } from "./run-store.ts";

export async function fetchSavedRuns(account: AccountService, store: RunStore, params: URLSearchParams) {
  return store.list((await account.requireUser()).id, params);
}
export async function fetchSavedRunsSummary(account: AccountService, store: RunStore) {
  return { summary: await store.summary((await account.requireUser()).id) };
}
export async function fetchSavedRun(account: AccountService, store: RunStore, runId: string) {
  return { run: await store.get((await account.requireUser()).id, runId) };
}
