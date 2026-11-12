# Do Better

Do Better is a local API load-testing application. The CLI serves its browser UI, runs requests, manages owner login, and stores results directly in SQLite. The public landing page is a separate app. No master server or database service needs to run.

## Development

Install the repository dependencies with Bun, then choose the application to run:

```sh
bun install
bun dev          # Public landing page only: http://127.0.0.1:5155
bun run dev:cli  # Build and start the complete CLI: http://127.0.0.1:4310
```

`bun dev` does not start the CLI or open a database. `dev:cli` builds the UI and the CLI, then starts the local workspace and opens a browser. For repeated source changes, run `bun start` from `apps/cli` after building the UI.

The CLI requires **Bun 1.3.14 or newer**. Its npm executable now uses Bun; Node alone is no longer supported. The published package includes bundled application code, UI assets, and versioned SQLite migrations. The landing page is not part of that package.

## Architecture

```text
Browser -> CLI HTTP server on 127.0.0.1:4310
             |-- load-test engine -> target API
             |-- owner authentication and sessions
             `-- projects and saved reports -> SQLite file
```

- `apps/cli`: application entrypoint, local API, engine, persistence and account services.
- `apps/cli/ui`: React browser interface.
- `apps/web`: public landing page, developed and built separately.
- `packages/auth`: shared Bun password hashing and database session logic, bundled into the CLI.
- `packages/db`: shared schema, migrations and Drizzle database helpers, bundled into the CLI.

The retired master server has been removed. The CLI handles its account and database operations directly.

## Configuration and data

Run `do-better start` from any directory. It reads optional `do-better.config.json` from that directory:

```json
{
  "port": 4310,
  "databasePath": "/absolute/path/to/do-better.sqlite"
}
```

The defaults are port **4310** and **`~/.do-better/do-better.sqlite`**. A relative database path resolves from the configuration file's directory. HTTP database URLs and the retired `apiUrl` configuration key are rejected with an explanation. Startup prints the selected database path. Port conflicts fail clearly; the CLI does not silently pick a different port.

**Existing checkout data:** `apps/cli/do-better.config.json` points to `./data/do-better.sqlite` so starting the CLI from `apps/cli` (including `dev:cli`) continues to use the existing owner, sessions and reports. The database and its SQLite companion files were moved together into `apps/cli/data`. Change `databasePath` to use another file; the CLI does not automatically copy or overwrite existing databases.

The CLI creates missing parent directories, opens SQLite, and applies committed migrations before accepting requests. A migration failure stops startup and preserves useful error context. SQLite uses foreign keys, WAL mode, and a five-second busy timeout. Database files use owner-only permissions and are excluded from Git. Back up a running SQLite database using a SQLite-aware backup method that includes committed WAL data, rather than copying only its main file during writes.

The data is unencrypted. Passwords use Argon2id hashes, but those hashes do not encrypt the database file. Dates use Unix milliseconds, results use JSON text, fractional request rates remain real numbers, and payment amounts use exact decimal strings. Payment amounts no longer have PostgreSQL numeric precision/scale enforcement. Search folds ASCII case using SQLite LIKE.

The legacy PostgreSQL Compose file is retained for access to previous PostgreSQL data. This application does not import those records automatically.

## Owner login and sessions

On first use, the UI asks you to create one owner's username and password. Subsequent visits offer sign-in. There is no public registration, email login or OAuth. Usernames contain 1–64 ASCII letters, numbers, dots, underscores or hyphens; passwords contain 8–128 characters. Password recovery and credential changes are not implemented.

The owner is created in an immediate SQLite transaction, preventing two competing setup requests from creating two owners. Credentials are checked with Bun's Argon2id implementation. Login/setup allow ten attempts per minute per CLI process.

Sessions use random 256-bit tokens with SHA-256 hashes in SQLite. The CLI stores its session cookie in `~/.do-better/session.json` with owner-only permissions, validates it directly against SQLite, and never exposes the token to the browser UI. Sessions last seven days and refresh after a day of activity. Logout revokes the current database session and clears the local session file.

The CLI remains a **local-only application**: it binds to loopback, validates Host and mutating request origins, and shares its active owner session within the local process. Public VPS exposure and browser-specific sessions remain separate self-hosting work.

## Running and saving tests

Install the published npm package and start it with Bun available on PATH:

```sh
npm install -g do-better-cli
do-better start
```

Configure your request in Playground. The engine executes on the machine running the CLI. Target headers and bodies remain in memory and are excluded from stored reports; response bodies are consumed for timing and discarded.

Completed runs save directly to SQLite. The engine-generated run ID is also the database record ID: identical retries do not duplicate records, while conflicting data for an existing ID is rejected. Duration is normalized to seconds and rate to requests per second. Project ownership is enforced when saving and reading history.

Failed saves remain in the owner-only `~/.do-better/pending-uploads.json` queue for retry. The filename and existing UI response identifiers are retained for compatibility; there is no network upload. Retry saves from Settings or the results page. Retries do not rerun the target. Existing queue files are preserved and only the current user's records are retried.

Overview and History query SQLite through the local API, including search, outcome filters, sorting and pagination. Results use the recent in-memory run when available and fall back to persisted history. Restarting the CLI loses only unsaved in-memory reports, not saved database results.

### Local UI API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/account` | Current owner status and project ID |
| `GET/POST /api/account/setup` | Check setup state or create the owner |
| `POST /api/account/sign-in` | Start a local database-backed session |
| `POST /api/account/sign-out` | Revoke the current session |
| `GET /api/runner` | Authenticated runner status |
| `POST /api/runs` | Execute and save a validated run |
| `GET /api/runs/:id` | Read a recent in-memory run |
| `POST /api/runs/:id/upload` | Retry saving a recent run (legacy path name) |
| `GET /api/saved-runs` | List saved reports |
| `GET /api/saved-runs/summary` | Aggregate history statistics |
| `GET /api/saved-runs/:id` | Read one owned report |
| `GET /api/uploads` | Count pending local saves (legacy path name) |
| `POST /api/uploads/retry` | Retry pending local saves (legacy path name) |

There is no backend `apiUrl`, port 47381 listener, cross-origin backend configuration or separate master API.

## Engine results

Results contain run timestamps, elapsed seconds, a stop reason, and these metrics:

- `requestsStarted`: requests actually dispatched.
- `requestsCompleted`: responses whose bodies were fully consumed.
- `requestsSucceeded`: completed responses with a 2xx status.
- `requestsFailed`: HTTP errors or network/body failures, including the HTTP 500 that stops a run.
- `requestsAborted`: in-flight requests cancelled when the run stops; these are separate from target failures.
- `requestsSkipped`: scheduled requests that could not start because the concurrency limit was reached.
- `statusCounts`: HTTP statuses received, including responses later cancelled while consuming their bodies.
- `latencyMs`: minimum, maximum, and average duration of successful or failed requests; cancellations are excluded. Timings include consuming the response body.

Response bodies are drained and discarded. They are never included in the engine result or saved to the local database. Target request payloads and authorization headers also stay local. Observed throughput can be calculated as `requestsCompleted / elapsedSeconds`; it describes this run, rather than proving the target's maximum capacity.

The engine retains its existing policy: stop at the configured duration, on HTTP 500, or on a network/body error. Other HTTP error statuses are counted while the run continues. Network failures return partial metrics with `stopReason: "request_error"` and an error message; invalid engine parameters reject before dispatching requests.

## Builds and database tooling

```sh
bun run build         # All application builds
bun run check-types   # All workspace type checks
bun run build:cli     # UI plus standalone Bun CLI with packaged migrations
bun run build:web     # Landing page only
bun run db:generate   # Create versioned SQLite migration files
bun run db:migrate    # Apply migrations to the configured checkout database
bun run db:studio     # Database inspection UI
```

Database tooling reads the CLI checkout configuration by default. `DATABASE_URL` is an optional file-path override for standalone database commands and resolves from their working directory. It is not required for normal CLI startup. Database migration commands must be run through Bun; no Varlock server environment generation is needed.

Build from source and create a package with `bun run build:cli` followed by `npm pack ./apps/cli`. The package bundles the auth/database code and required dependencies, plus `dist/migrations`; fresh installations therefore need neither workspace packages nor a source checkout. Read the filename printed by `npm pack` rather than assuming a version number.
