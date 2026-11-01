import { join } from "node:path";
import { readJsonFile, resolveStateDirectory, writeJsonFile } from "./local-state.ts";

const PROJECT_FILENAME = "project.json";

interface StoredProject {
  userId: string;
  projectId: string;
}

export class ProjectStore {
  private readonly path: string;
  private loaded = false;
  private stored: StoredProject | null = null;

  constructor(stateDirectory?: string) {
    this.path = join(resolveStateDirectory(stateDirectory), PROJECT_FILENAME);
  }

  async getForUser(userId: string) {
    await this.load();
    return this.stored?.userId === userId ? this.stored.projectId : null;
  }

  async setForUser(userId: string, projectId: string) {
    this.stored = { userId, projectId };
    this.loaded = true;
    await writeJsonFile(this.path, this.stored);
  }

  private async load() {
    if (this.loaded) return;
    const value = await readJsonFile(this.path);
    this.loaded = true;
    if (value === null) {
      this.stored = null;
      return;
    }
    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as { userId?: unknown }).userId === "string" &&
      typeof (value as { projectId?: unknown }).projectId === "string"
    ) {
      this.stored = value as StoredProject;
      return;
    }
    this.stored = null;
    throw new Error(`Invalid project state in ${this.path}. Sign in again to replace it.`);
  }
}
