import { createServer } from "node:http";

const page = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>do-better</title></head>
<body><main><h1>do-better</h1><p>Your local server is running.</p>
<p>The UI is coming next. No API test is running.</p></main></body>
</html>`;

export async function startLocalServer(port: number) {
  const host = "127.0.0.1";
  const server = createServer((req, res) => {
    // Keep the local service inaccessible through attacker-controlled DNS names.
    const address = server.address();
    const expectedHost = typeof address === "object" && address ? `${host}:${address.port}` : "";
    if (req.headers.host !== expectedHost) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    if (req.url !== "/") {
      res.writeHead(404).end("Not found");
    } else if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : page);
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  return server;
}
