import { resolve } from "node:path";

export type DatabaseConfig = {
  DATABASE_URL: string;
};

/** Resolve SQLite paths at the owning application's boundary, not at the ORM call site. */
export function resolveDatabasePath(value: string, baseDirectory: string): string {
  if (value === ":memory:") return value;
  if (!value.trim() || /^[a-z][a-z\d+.-]*:/i.test(value)) {
    throw new Error("DATABASE_URL must be a SQLite file path, not a database connection URL.");
  }
  return resolve(baseDirectory, value);
}
