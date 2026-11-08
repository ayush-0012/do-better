# do-better

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Express, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Express** - Fast, unopinionated web framework
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **SQLite** - Embedded database engine
- **Authentication** - Single-owner username/password login
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses SQLite through Bun's built-in driver and Drizzle ORM. No database service or Docker container is required.

1. Set `DATABASE_URL=./data/do-better.sqlite` in `apps/server/.env` (also the schema default).
2. Apply the committed migrations:

```bash
bun run --cwd packages/db db:migrate
```

Relative database paths resolve from `apps/server` for both the server and database tooling. Absolute paths are supported. The parent directory is created automatically. The default file is `apps/server/data/do-better.sqlite`; database files and WAL sidecars are excluded from Git. PostgreSQL connection URLs are rejected to prevent accidentally opening the wrong file.

The server enables foreign keys, WAL mode, and a five-second busy timeout. Timestamps use integer Unix milliseconds, booleans use integers, results use JSON text, and payment amounts remain decimal strings to avoid floating-point rounding. Payment amounts no longer have PostgreSQL's numeric precision/scale enforcement; callers must supply valid decimal strings. Saved-run search uses SQLite LIKE, which folds ASCII case but does not provide PostgreSQL's locale-aware Unicode case folding.

`db:generate` creates versioned migrations; `db:migrate` applies them. `db:push` directly synchronizes the schema for local development. `db:start` applies migrations, `db:watch` opens Studio, and `db:stop`/`db:down` preserve data without managing a service. Run database scripts through Bun so Drizzle Kit uses its installed Bun driver.

The legacy PostgreSQL Compose file is retained for access to existing data. SQLite migrations create a new schema; they do **not** import PostgreSQL records. Existing PostgreSQL containers and volumes are untouched.

Then, run the development server:

```bash
bun run dev
```

The API is running at [http://localhost:47381](http://localhost:47381).

## Deploy the backend on Railway

This is a shared Bun monorepo. Keep Railway's **Root Directory** at the repository
root so the build can access `packages/auth`, `packages/db`, the shared configuration,
and the CLI's validation schemas. Configure the backend service with these settings.

| Setting | Value |
| --- | --- |
| Build command | `bun run build:server` |
| Start command | `bun run start:server` |
| Healthcheck path | `/` |

Use the repository's `bun.lock` and Bun version from `packageManager` when installing
dependencies. The root postinstall script generates the Varlock environment types.
The build compiles the backend and bundles the shared workspace code.

Set `NODE_ENV=production`, `DATABASE_URL` to a SQLite path on persistent local storage (for example `/data/do-better.sqlite`),
`SERVER_ORIGIN` to the backend's public HTTPS origin. Set `CORS_ORIGIN` to the
browser origin allowed to access the backend. For the local CLI UI using its default
port, this is `http://127.0.0.1:4310`. Set up the owner through the UI before exposing an unconfigured server publicly.

Railway supplies `PORT`. The server binds to that port on `0.0.0.0` and defaults
to port 47381 locally. Configure the deployed database schema separately before
using authentication or saved runs. Schema changes require an explicit database
operation and are not performed by the build or start commands.

The CLI defaults to the local master at `http://localhost:47381` in every environment.
To use a master at another address, set `apiUrl` in `do-better.config.json`.

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `bun run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform.

Import the generated `ENV` accessor in application code. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

Bun's automatic env loading is disabled in `bunfig.toml`; the framework integration or server bootstrap loads Varlock. The backend requires Bun for `bun:sqlite`; deployments must include Varlock and its dependencies alongside the app schema. SQLite deployments require a persistent disk and a single application instance; an ephemeral deployment filesystem will lose saved data when replaced.

Run standalone Node/Bun tools that use Varlock from the owning app directory so they load that app's schema and env files. `env:generate` only generates TypeScript files; it does not initialize environment values in a subsequent command.

## Project Structure

```
do-better/
├── apps/
│   ├── cli/         # Local request engine and configuration
│   ├── server/      # Backend API (Express)
│   └── web/         # Public product website (React + Vite)
├── packages/
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start the public website on port 5155 and the backend
- `bun run build:web`: Build the standalone website into `apps/web/dist`
- `bun run build`: Build all applications
- `bun run dev:server`: Start only the server
- `bun run check-types`: Check TypeScript types across all apps
- `bun run db:push`: Push schema changes to database
- `bun run db:generate`: Generate versioned SQL migrations
- `bun run db:migrate`: Run database migrations
- `bun run db:studio`: Open database studio UI

## Owner setup and login

The installation has one owner. On first opening the CLI UI, create a username and password, confirm the password, and enter the workspace. After setup, that form becomes a sign-in form; there is no public signup, email login, or OAuth flow.

**Complete setup before exposing the server publicly.** The first successful setup request claims the installation. Keep it private or use an SSH tunnel until the owner is configured. Setup runs in an immediate SQLite transaction, so concurrent requests cannot create two owners.

Usernames are case-sensitive and contain 1–64 ASCII letters, numbers, dots, underscores, or hyphens. Passwords must contain 8–128 characters. The server stores only an Argon2id password hash in `user.password_hash`, never the plaintext password. Password recovery and credential changes are not implemented.

Sessions live in the `session` table with SHA-256 hashes of random 256-bit tokens. The raw token is sent in an HttpOnly, SameSite=Lax cookie and is persisted by the local CLI in its owner-only session file. Cookies also use Secure in production. Sessions last seven days and refresh after a day of activity; logout revokes the current session. Credential hashing endpoints allow ten attempts per minute per server process; this limit resets on restart. Mutating requests reject untrusted browser origins.

### Server configuration

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | SQLite file path, relative to `apps/server` or absolute |
| `SERVER_ORIGIN` | Backend origin used by the CLI, such as `http://localhost:47381`; use the public HTTPS origin in production |
| `CORS_ORIGIN` | Browser origin allowed to access the backend |

No Better Auth secrets or OAuth credentials are needed. Existing unused keys in local env files can be removed. Run `bun run env:generate` after editing an environment schema.

The versioned owner-login migration removes the old account/verification tables and replaces the user/session layouts. It deliberately **refuses populated legacy auth tables**: existing identities require a separately planned conversion rather than silently dropping credentials or ownership. The current local database was empty when migrated. Apply committed migrations with `bun run --cwd packages/db db:migrate`.

### Master login endpoints

| Endpoint | Behavior |
| --- | --- |
| `GET /api/auth/setup` | Returns `{ "setupRequired": true/false }` |
| `POST /api/auth/setup` | Creates the only owner and signs in; accepts `{ "username", "password" }`; returns 409 after setup |
| `POST /api/auth/sign-in` | Verifies username/password and starts a session |
| `GET /api/auth/get-session` | Returns `{ "user": { "id", "username" } }` or `null` |
| `POST /api/auth/sign-out` | Revokes the current session and clears its cookie |
| `GET /api/me` | Returns the signed-in user's public fields, or 401 |

Passwords, password hashes, and session hashes never appear in these responses. Existing CLI session files from Better Auth expire on their next check; sign in again with the newly configured owner.

### Verification

Run type checks and builds for the affected packages:

```sh
bun run --cwd apps/server check-types
bun run --cwd apps/server build
bun run --cwd apps/cli check-types
bun run --cwd apps/cli build
bun run --cwd apps/cli/ui check-types
bun run --cwd apps/cli/ui build
```

## Local test runs and master storage

### Launching the local UI server

The CLI registers `do-better start` as its package executable. It binds to `127.0.0.1`, serves the built React UI
from `apps/cli/ui/dist`, and opens its URL in the default browser. Stop it with Ctrl+C.

Install the CLI from npm and start it:

```sh
npm install -g do-better-cli
do-better start
```

To build and pack the CLI from source, run these commands from the repository root:

```sh
bun run build:cli
npm pack ./apps/cli
```

This produces `do-better-cli-0.1.0.tgz` with the compiled command and UI assets.
To test that tarball locally, install it globally:

```sh
npm install -g ./do-better-cli-0.1.0.tgz
do-better start
```

For development, run `bun start` from `apps/cli` after building the UI.

The CLI requires Node.js 22.18 or newer. It reads optional
`do-better.config.json` from the directory where the command is run:

```json
{ "port": 4310, "apiUrl": "http://localhost:47381" }
```

With no file or settings, the defaults are `4310` and `http://localhost:47381`.
Development and production both use this local default; there is no hosted fallback.
`apiUrl` must be the master server origin without a path, query, or credentials;
plain HTTP is accepted only for loopback hosts, and other hosts require HTTPS.
There is no command-line port option. Invalid configuration or an occupied port
fails with a clear error; the CLI does not silently choose another port. If
browser opening fails, use the URL printed in the terminal.

While the CLI is running, the UI uses `GET /api/runner`, `POST /api/runs`, and
`GET /api/runs/:id` to run tests and open their reports. Recent runs are kept in
memory and are lost when the server restarts; completed runs saved to the master
survive locally through the retry queue described below.

### Signing in and saving runs

Create the installation owner on first use, or sign in with the existing username and password.
The workspace and `POST /api/runs` require a signed-in owner. The CLI stores
the session cookie at `~/.do-better/session.json` (owner-only, mode
`0600`) and never sends it to the browser UI. On startup it validates the saved
session with `GET /api/auth/get-session`; an invalid session is discarded, while
an unreachable master shows an offline state with a retry action.

When a run finishes while signed in, the CLI uploads it automatically. The
server assigns the project ID when the CLI calls `POST /api/projects`; the CLI
stores it in `~/.do-better/project.json` and reuses it for later runs. Uploads go
through `POST /api/test-runs` with the engine parameters (without `requestData`)
and the result.

Failed uploads are kept in `~/.do-better/pending-uploads.json` (owner-only, at
most 200 records) as `{ userId, projectId, params, result }`. The file contains
the target URL and aggregate metrics, never headers or request bodies. Retry
from the results page, from Settings, or automatically on the next sign-in and
startup. Retrying only repeats the upload; the target is never rerun. Runs
completed after you sign out are labeled `not_signed_in` and are not queued; after
signing in, their results page offers a one-time save action.

### Saved run history

Overview and History read the signed-in user's saved runs from the master through
the CLI. Workspace pages send signed-out visitors back to the local sign-in screen. History
filters, sorting, and pagination run in the master API, so totals stay accurate
beyond the first page. Run results open from CLI memory when available and fall
back to the master for saved runs.

The master stores uploads with duration in seconds and a rate normalized to
requests per second; saved configurations therefore report `per_second` even when
the original run used per-minute values. The API omits legacy rows whose stored
result is missing or invalid.

Local account, upload, and history endpoints:

| Endpoint | Behavior |
| --- | --- |
| `GET /api/account` | Current account state, user, backend origin, and project ID |
| `GET /api/account/setup` | Check whether this installation needs owner setup |
| `POST /api/account/setup` | Create the owner with username/password, then retry pending uploads |
| `POST /api/account/sign-in` | Username/password sign-in, then retry pending uploads |
| `POST /api/account/sign-out` | Sign out locally and clear the saved session |
| `GET /api/uploads` | Count of runs waiting to upload |
| `POST /api/uploads/retry` | Retry the signed-in user's pending uploads |
| `GET /api/saved-runs` | Proxy saved runs with `limit`, `offset`, `search`, `outcome`, and `sort` |
| `GET /api/saved-runs/summary` | Proxy aggregate history metrics and the latest run |
| `GET /api/saved-runs/:id` | Proxy one saved run owned by the signed-in user |

Run `bun run --cwd apps/cli/ui dev` to preview the local account access,
overview, playground, history, results, and settings. The UI supports light/dark
themes, executes runs through the local runner, and shows saved master history
on overview and history. See [the UI README](apps/cli/ui/README.md)
for verification and module details.

`runEngine(params)` in `apps/cli/src/engine.ts` executes POST requests to the configured target and returns an `EngineResult`. The CLI folder owns the engine, configuration/result schemas, scheduling helpers, and engine tests. The master imports the schemas for upload validation and handles authentication and database operations; it does not execute requests against the submitted URL. The launch command, local UI server, local execution API, account sign-in, and master uploads are implemented.

Results contain run timestamps, elapsed seconds, a stop reason, and these metrics:

- `requestsStarted`: requests actually dispatched.
- `requestsCompleted`: responses whose bodies were fully consumed.
- `requestsSucceeded`: completed responses with a 2xx status.
- `requestsFailed`: HTTP errors or network/body failures, including the HTTP 500 that stops a run.
- `requestsAborted`: in-flight requests cancelled when the run stops; these are separate from target failures.
- `requestsSkipped`: scheduled requests that could not start because the concurrency limit was reached.
- `statusCounts`: HTTP statuses received, including responses later cancelled while consuming their bodies.
- `latencyMs`: minimum, maximum, and average duration of successful or failed requests; cancellations are excluded. Timings include consuming the response body.

Response bodies are drained and discarded. They are never included in the engine result or saved to the master database. Target request payloads and authorization headers also stay local. Observed throughput can be calculated as `requestsCompleted / elapsedSeconds`; it describes this run, rather than proving the target's maximum capacity.

The engine retains its existing policy: stop at the configured duration, on HTTP 500, or on a network/body error. Other HTTP error statuses are counted while the run continues. Network failures return partial metrics with `stopReason: "request_error"` and an error message; invalid engine parameters reject before dispatching requests.

The authenticated master endpoints are:

| Endpoint | Behavior |
| --- | --- |
| `POST /api/projects` | Create a project belonging to the session's user; returns `{ "project": ... }` |
| `POST /api/test-runs` | Validate and store `{ "projectId": ..., "params": ..., "result": ... }`; returns `{ "run": ... }` |
| `GET /api/test-runs/:id` | Read a saved run owned by the session's user |
| `GET /api/saved-runs` | List the user's saved runs with `limit` (1–100), `offset`, `search`, `outcome` (`all`, `completed`, `stopped`), and `sort` (`newest`, `oldest`) |
| `GET /api/saved-runs/summary` | Aggregate run counts, request success, endpoint count, and the latest saved run |
| `GET /api/saved-runs/:id` | Read one saved run in the same shape the local runner returns |

`GET /api/saved-runs` returns `{ "runs": [...], "total": ..., "limit": ..., "offset": ... }`.
Each saved run contains its configuration, engine result, project ID, and upload
time. Saved configurations are reconstructed from stored columns, so rates are
reported per second and request headers/bodies remain absent.

Use the existing engine parameters as `params`, omitting `requestData`, and the returned `EngineResult` as `result`. The server strips unrecognized fields, checks project ownership, normalizes duration to seconds and rate to requests per second, and stores only the validated result. No `userId` supplied by the client is trusted.

The engine-generated result ID also identifies the database record. A first upload returns `201`; an identical retry returns the existing record with `200`. Reusing an ID for different data returns `409`. If an upload fails, keep the local result and retry uploading it rather than rerunning the target test.

The application schema adds nullable target URL and JSON result columns for compatibility with older records, permits fractional request rates, and leaves the unused legacy `maxRequests` value nullable. `reqHandled` records completed requests. Apply the schema from `packages/db` with `bun run db:push` after configuring the application database connection.
