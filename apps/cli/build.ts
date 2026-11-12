import { cpSync, chmodSync } from "node:fs";

const result = await Bun.build({ entrypoints: ["./src/index.ts"], outdir: "./dist", target: "bun", sourcemap: "external" });
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
cpSync("../../packages/db/src/migrations", "./dist/migrations", { recursive: true });
chmodSync("./dist/index.js", 0o755);
console.log("Built standalone Bun CLI and packaged SQLite migrations.");
