# Do Better CLI

Do Better is a browser-based tool for load testing HTTP APIs from your own machine. Build a POST request in the Playground, choose a traffic profile, and inspect HTTP status counts, throughput, and response times. Sign in to run tests and save results to your account.

## Install and start

You need **Bun 1.3.14 or newer** on PATH. You can install the npm package using npm; the CLI runtime itself is Bun. The package includes the UI, application code and SQLite migrations. No separate master server is required.

```sh
npm install -g do-better-cli
do-better start
```

The CLI opens the UI at `http://127.0.0.1:4310`. If your browser doesn’t open, visit the URL printed in the terminal. Press **Ctrl+C** in that terminal to stop the CLI. Run `do-better --help` for command usage.

## Sign in

On first use, the CLI asks you to choose the owner username and password. Later visits offer username/password sign-in. After signing in, you can open the Playground,
Overview, History, and Settings.

To change the local UI port, create `do-better.config.json` in the directory
where you run `do-better start`, then restart the CLI:

```json
{
  "port": 4311
}
```

## Run your first test

Use a POST endpoint you control. If you need a target, start this small JSON echo server in a second terminal:

```sh
node --input-type=module -e '
import { createServer } from "node:http";
createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/api/echo") {
    res.writeHead(404).end();
    return;
  }
  res.setHeader("Content-Type", "application/json");
  req.pipe(res);
}).listen(4400, "127.0.0.1", () => console.log("Listening on http://127.0.0.1:4400/api/echo"));
'
```

1. Open **Playground** and set the URL to `http://127.0.0.1:4400/api/echo`.
2. Set the `Content-Type` header to `application/json` and enter `{"message":"hello"}` as the request body.
3. Select **Constant**, set the rate to **5 requests per second**, duration to **10 seconds**, and concurrency to **2**.
4. Choose **Run test**. In the results, look for HTTP `200` responses in **HTTP status distribution**.

Use **Ramp**, **Burst**, or **Random** to vary traffic over time. The concurrency setting limits simultaneous in-flight requests. The runner records skipped requests when all slots are busy.

## Read and save results

- **Succeeded** counts HTTP `2xx` responses. Use **HTTP status distribution** to distinguish errors such as `400` (invalid request) and `429` (rate limited). HTTP `500` and network errors can stop the run early.
- **Throughput** shows completed requests per second. Latency shows the minimum, average, and maximum time through reading the response body.
- **History** shows saved runs and lets you reopen a report or load its configuration into the Playground. If a save fails, retry from the report or **Settings → Account**. Retrying a save doesn’t send another load test.

Target requests run from your machine. Saved reports can include the target URL, run settings, and aggregate metrics. Request headers and payloads are excluded from saved results, and response bodies are discarded after timing.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `do-better: command not found` | Check that the global npm install succeeded and npm’s global executable directory is on your `PATH`. Run `npm prefix -g` to find the install prefix. |
| Port `4310` is already in use | Stop the process using it or set another port in `do-better.config.json`. |
| Sign-in or saving fails | Check the CLI terminal, database path and file permissions. |
| Every request fails | Check the HTTP status distribution, then confirm that the target is reachable from your machine and that it accepts POST with the headers and body you entered. |

## Local database

By default, saved data lives in `~/.do-better/do-better.sqlite`. Set `databasePath` in `do-better.config.json` to use another file; relative paths resolve from that config file’s directory. Startup applies packaged migrations automatically. The retired `apiUrl` setting is no longer accepted.

## Build from source

With the [repository](https://github.com/ayush-0012/do-better) checked out and its Bun dependencies installed, run from the repository root:

```sh
bun run build:cli
npm pack ./apps/cli
npm install -g ./do-better-cli-0.1.0.tgz
do-better start
```

Use the filename printed by `npm pack` if the package version has changed.
