import { join } from "node:path";
import {
  engineParamsSchema,
  engineResultSchema,
  type EngineParams,
  type EngineResult,
} from "./constants.ts";
import { AccountError, type AccountService } from "./account.ts";
import { readJsonFile, resolveStateDirectory, writeJsonFile } from "./local-state.ts";
import { ProjectStore } from "./projects.ts";
import type { LocalRun, RunConfiguration } from "./runner.ts";

const PENDING_FILENAME = "pending-uploads.json";
const MAX_PENDING_UPLOADS = 200;

type UploadParams = Omit<EngineParams, "requestData">;

export type RunUploadState =
  | { state: "uploaded"; projectId: string }
  | { state: "pending"; error: string; projectId: string | null }
  | { state: "not_signed_in" }
  | { state: "not_uploaded" };

export interface PendingUploadSummary {
  count: number;
  error?: string;
}

export interface RetrySummary {
  uploaded: number;
  remaining: number;
  error?: string;
}

export interface UploadServiceOptions {
  account: AccountService;
  stateDirectory?: string;
}

interface PendingUpload {
  userId: string;
  projectId: string | null;
  params: UploadParams;
  result: EngineResult;
}

export class UploadService {
  private readonly account: AccountService;
  private readonly pendingPath: string;
  private readonly projects: ProjectStore;
  private readonly uploadStates = new Map<string, RunUploadState>();
  private pending: PendingUpload[] | null = null;
  private loadError: string | undefined;
  private pendingQueue: Promise<unknown> = Promise.resolve();

  constructor({ account, stateDirectory }: UploadServiceOptions) {
    this.account = account;
    this.pendingPath = join(resolveStateDirectory(stateDirectory), PENDING_FILENAME);
    this.projects = new ProjectStore(stateDirectory);
  }

  async initialize() {
    try {
      this.pending = await this.loadPending();
    } catch (error) {
      this.loadError =
        error instanceof Error ? error.message : "The pending upload file could not be read.";
    }
  }

  async getProjectId(userId: string) {
    return this.projects.getForUser(userId);
  }

  getUploadState(runId: string): RunUploadState {
    return this.uploadStates.get(runId) ?? { state: "not_uploaded" };
  }

  async getPendingSummary(userId?: string): Promise<PendingUploadSummary> {
    return this.withPendingLock(async () => {
      await this.ensureLoaded();
      const count = this.pending?.length ?? 0;
      const visible = userId
        ? (this.pending ?? []).filter((record) => record.userId === userId).length
        : count;
      return this.loadError ? { count: visible, error: this.loadError } : { count: visible };
    });
  }

  /** Uploads once and keeps the run for a later retry if anything fails. */
  async uploadCompletedRun(run: LocalRun): Promise<RunUploadState> {
    const account = this.account.getStatus();
    if (account.state !== "signed_in") {
      const state: RunUploadState = { state: "not_signed_in" };
      this.uploadStates.set(run.result.id, state);
      return state;
    }

    const params = toUploadParams(run.configuration);
    try {
      const projectId = await this.uploadRun(account.user.id, params, run.result, null);
      const state: RunUploadState = { state: "uploaded", projectId };
      this.uploadStates.set(run.result.id, state);
      return state;
    } catch (error) {
      let projectId: string | null = null;
      try {
        projectId = await this.projects.getForUser(account.user.id);
      } catch {
        projectId = null;
      }

      let message = errorMessage(error);
      try {
        await this.enqueue({
          userId: account.user.id,
          projectId,
          params,
          result: run.result,
        });
      } catch (queueError) {
        message = `${message} The retry record could not be saved: ${errorMessage(queueError)}`;
      }

      const state: RunUploadState = { state: "pending", error: message, projectId };
      this.uploadStates.set(run.result.id, state);
      return state;
    }
  }

  /** Retries only the current user's pending uploads; runs are never rerun. */
  retryPending(): Promise<RetrySummary> {
    return this.withPendingLock(() => this.retryPendingLocked());
  }

  private async retryPendingLocked(): Promise<RetrySummary> {
    await this.ensureLoaded();
    if (this.loadError) {
      return { uploaded: 0, remaining: this.pending?.length ?? 0, error: this.loadError };
    }

    const account = this.account.getStatus();
    if (account.state !== "signed_in") {
      return {
        uploaded: 0,
        remaining: this.pending?.length ?? 0,
        error: "Sign in to the master server before retrying saved runs.",
      };
    }

    const remaining: PendingUpload[] = [];
    let uploaded = 0;
    let remainingForUser = 0;
    for (const record of this.pending ?? []) {
      if (record.userId !== account.user.id) {
        remaining.push(record);
        continue;
      }

      try {
        const projectId = await this.uploadRun(account.user.id, record.params, record.result, record.projectId);
        uploaded += 1;
        this.uploadStates.set(record.result.id, { state: "uploaded", projectId });
      } catch (error) {
        let projectId = record.projectId;
        if (!projectId) {
          try {
            projectId = await this.projects.getForUser(account.user.id);
          } catch {
            projectId = null;
          }
        }
        remaining.push({ ...record, projectId });
        remainingForUser += 1;
        this.uploadStates.set(record.result.id, {
          state: "pending",
          error: errorMessage(error),
          projectId,
        });
      }
    }

    this.pending = remaining;
    await this.persistPending();
    return { uploaded, remaining: remainingForUser };
  }

  private async uploadRun(
    userId: string,
    params: UploadParams,
    result: EngineResult,
    projectId: string | null,
  ) {
    let targetProject = projectId ?? (await this.ensureProject(userId));
    try {
      await this.postRun(targetProject, params, result);
      return targetProject;
    } catch (error) {
      if (error instanceof AccountError && error.status === 404) {
        targetProject = await this.createProject(userId);
        await this.postRun(targetProject, params, result);
        return targetProject;
      }
      throw error;
    }
  }

  private async ensureProject(userId: string) {
    const existing = await this.projects.getForUser(userId);
    return existing ?? this.createProject(userId);
  }

  private async createProject(userId: string) {
    const response = await this.account.fetchWithSession("/api/projects", {
      method: "POST",
      body: {},
    });
    const projectId = readProjectId(await response.json());
    try {
      await this.projects.setForUser(userId, projectId);
    } catch {
      // The upload can proceed with the project returned for this session.
    }
    return projectId;
  }

  private async postRun(projectId: string, params: UploadParams, result: EngineResult) {
    try {
      await this.account.fetchWithSession("/api/test-runs", {
        method: "POST",
        body: { projectId, params, result },
      });
    } catch (error) {
      if (error instanceof AccountError && error.status === 401) {
        await this.account.invalidate();
      }
      throw error;
    }
  }

  private enqueue(record: PendingUpload) {
    return this.withPendingLock(() => this.enqueueLocked(record));
  }

  private async enqueueLocked(record: PendingUpload) {
    await this.ensureLoaded();
    if (this.loadError) throw new Error(this.loadError);

    const pending = this.pending ?? [];
    const index = pending.findIndex((entry) => entry.result.id === record.result.id);
    if (index >= 0) {
      pending[index] = record;
    } else {
      if (pending.length >= MAX_PENDING_UPLOADS) {
        throw new Error(
          `There are already ${MAX_PENDING_UPLOADS} runs waiting to upload. Sign in and retry before running more.`,
        );
      }
      pending.push(record);
    }
    this.pending = pending;
    await this.persistPending();
  }

  private withPendingLock<T>(task: () => Promise<T>): Promise<T> {
    const result = this.pendingQueue.then(task, task);
    this.pendingQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async ensureLoaded() {
    if (this.pending !== null || this.loadError) return;
    try {
      this.pending = await this.loadPending();
    } catch (error) {
      this.loadError =
        error instanceof Error ? error.message : "The pending upload file could not be read.";
    }
  }

  private async loadPending(): Promise<PendingUpload[]> {
    const value = await readJsonFile(this.pendingPath);
    if (value === null) return [];
    if (!Array.isArray(value)) {
      throw new Error(`Invalid pending upload file at ${this.pendingPath}.`);
    }

    return value.map((entry, index) => {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`Invalid pending upload at index ${index} in ${this.pendingPath}.`);
      }
      const record = entry as Record<string, unknown>;
      const params = engineParamsSchema.omit({ requestData: true }).safeParse(record.params);
      const result = engineResultSchema.safeParse(record.result);
      if (!params.success || !result.success
        || typeof record.userId !== "string"
        || (record.projectId !== null && typeof record.projectId !== "string")) {
        throw new Error(`Invalid pending upload at index ${index} in ${this.pendingPath}.`);
      }
      return {
        userId: record.userId,
        projectId: record.projectId,
        params: params.data,
        result: result.data,
      };
    });
  }

  private async persistPending() {
    await writeJsonFile(this.pendingPath, this.pending ?? []);
  }
}

function toUploadParams(configuration: RunConfiguration): UploadParams {
  const minutes = Math.floor(configuration.durationSeconds / 60);
  return {
    url: configuration.url,
    requestPattern: configuration.pattern as EngineParams["requestPattern"],
    requestRate: configuration.rate,
    requestRateUnit: configuration.rateUnit as EngineParams["requestRateUnit"],
    duration: {
      minutes,
      seconds: configuration.durationSeconds - minutes * 60,
    },
    concurrencyLimit: configuration.concurrency,
  };
}

function readProjectId(payload: unknown) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The master server returned an invalid project.");
  }
  const project = (payload as { project?: unknown }).project;
  if (project === null || typeof project !== "object" || Array.isArray(project)) {
    throw new Error("The master server returned an invalid project.");
  }
  const id = (project as { id?: unknown }).id;
  if (typeof id !== "string" || !id) {
    throw new Error("The master server returned an invalid project.");
  }
  return id;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
