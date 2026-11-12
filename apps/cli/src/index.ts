#!/usr/bin/env bun
import { runCli } from "./cli.ts";

try {
  await runCli(process.argv.slice(2));
} catch (error) {
  console.error(`do-better: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
