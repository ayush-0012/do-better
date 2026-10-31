import { loadConfig } from "./config.ts";
import { openBrowser } from "./browser.ts";
import { startLocalServer } from "./server.ts";

export async function runCli(
  args: string[],
  { directory = process.cwd(), launchBrowser = openBrowser } = {},
) {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    console.log("Usage: do-better start\nPort: do-better.config.json in the current directory (default: 4310).");
    return;
  }
  if (args.length !== 1 || args[0] !== "start") {
    throw new Error("Usage: do-better start (set the port in do-better.config.json)");
  }
  const { port } = await loadConfig(directory);
  const server = await startLocalServer(port).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      throw new Error(`Port ${port} is already in use. Stop the other process or change port in do-better.config.json.`);
    }
    throw error;
  });
  const url = `http://127.0.0.1:${port}`;
  console.log(`do-better is running at ${url}\nPress Ctrl+C to stop.`);

  const shutdown = () => {
    server.close();
    server.closeAllConnections();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  server.once("close", () => {
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
  });
  try {
    await launchBrowser(url);
  } catch (error) {
    console.error(`Could not open the browser: ${error instanceof Error ? error.message : String(error)}. Open ${url} manually.`);
  }
  return server;
}
