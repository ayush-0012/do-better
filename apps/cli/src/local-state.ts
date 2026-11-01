import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_STATE_DIRECTORY = join(homedir(), ".do-better");

/** Owner-only local state; the session file is a bearer credential. */
export function resolveStateDirectory(override?: string) {
  return override ?? DEFAULT_STATE_DIRECTORY;
}

export async function readJsonFile(path: string): Promise<unknown | null> {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(`Cannot read ${path}`, { cause: error });
  }

  try {
    await chmod(path, 0o600);
  } catch {
    // Best-effort permission tightening; older files may be owned elsewhere.
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}`, { cause: error });
  }
}

export async function writeJsonFile(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  try {
    await chmod(dirname(path), 0o700);
  } catch {
    // Best-effort permission tightening for an existing directory.
  }

  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  try {
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function removeJsonFile(path: string) {
  await rm(path, { force: true });
}
