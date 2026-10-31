# do-better

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Express, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Express** - Fast, unopinionated web framework
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
bun run db:push
```

Then, run the development server:

```bash
bun run dev
```

The API is running at [http://localhost:3000](http://localhost:3000).

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `bun run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform.

Import the generated `ENV` accessor in application code. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

Bun's automatic env loading is disabled in `bunfig.toml`; the framework integration or server bootstrap loads Varlock. Node deployments must include Varlock and its dependencies alongside the app schema.

Run standalone Node/Bun tools that use Varlock from the owning app directory so they load that app's schema and env files. `env:generate` only generates TypeScript files; it does not initialize environment values in a subsequent command.

## Project Structure

```
do-better/
├── apps/
│   ├── cli/         # Local request engine and configuration
│   └── server/      # Backend API (Express)
├── packages/
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:server`: Start only the server
- `bun run check-types`: Check TypeScript types across all apps
- `bun run db:push`: Push schema changes to database
- `bun run db:generate`: Generate database client/types
- `bun run db:migrate`: Run database migrations
- `bun run db:studio`: Open database studio UI

## Better Auth Schema Generation

After changing auth plugins or schema options, run `bun run auth:generate` from the project root. The script runs the Better Auth CLI through `varlock run` from the owning app directory, loading the auth instance from `src/services.ts`. Review the schema changes, then use your ORM's migration workflow to apply them.

## Authentication

The backend supports email/password, Google, and GitHub through Better Auth. All three use PostgreSQL-backed sessions. The existing `user`, `account`, `session`, and `verification` tables support these methods without a schema change.

### Server configuration

Set these values in the server's ignored `apps/server/.env` file or deployment environment:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | A random secret of at least 32 characters; generate one with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public backend origin, such as `http://localhost:3000` for development |
| `CORS_ORIGIN` | The explicitly allowed frontend origin; use `http://localhost:3000` for the backend-only examples below |
| `GOOGLE_CLIENT_ID` | Google OAuth web application's client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth web application's client secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth application's client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth application's client secret |

All four provider settings are required. Keep OAuth secrets on the backend; do not include them in UI assets, the CLI package, or committed files. Run `bun run env:generate` from `apps/server` after editing its environment schema. The generated `src/env.ts` remains managed by Varlock.

### OAuth application registration

Create separate development and production applications/credentials for each provider. Set `BETTER_AUTH_URL` to the backend's externally visible origin and register these exact callback URLs:

| Provider | Development callback | Production callback |
| --- | --- | --- |
| Google | `http://localhost:3000/api/auth/callback/google` | `https://YOUR_BACKEND_DOMAIN/api/auth/callback/google` |
| GitHub | `http://localhost:3000/api/auth/callback/github` | `https://YOUR_BACKEND_DOMAIN/api/auth/callback/github` |

- **Google:** Create a Web application OAuth client in Google Cloud Console, configure its consent screen/audience, and add test users when using testing mode. Register the authorized redirect URI and copy the client ID and secret to the backend environment. The built-in provider requests `openid`, `email`, and `profile`. See [Better Auth's Google setup](https://better-auth.com/docs/authentication/google) and [Google's web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server).
- **GitHub:** Create an OAuth App in GitHub Developer Settings with the callback above. The built-in provider requests `read:user` and `user:email`, including private-email lookup; it does not request repository permissions. If using a GitHub App instead, grant Account permissions → Email addresses → Read-only. See [Better Auth's GitHub setup](https://better-auth.com/docs/authentication/github).

Initiate either provider through `POST /api/auth/sign-in/social`:

```json
{
  "provider": "google",
  "callbackURL": "http://localhost:3000/"
}
```

Use `"github"` for GitHub. In a browser, navigate to the returned authorization `url`, preserving the cookies from initiation. Better Auth handles the provider callback, exchanges the authorization code, creates the session, and redirects to `callbackURL`. That final application return URL must be trusted; it is separate from the provider callback registered above. No custom token-exchange endpoint is needed.

Provider callbacks currently terminate at the configured backend. Returning an authenticated session to arbitrary localhost or self-hosted UIs is deferred until the UI/gateway architecture is implemented.

### Sessions and account linking

Sessions last seven days and are eligible for rolling refresh after one day of activity. Session cookies are host-only, `HttpOnly`, and `SameSite=Lax`; HTTPS uses `Secure` cookies, while local HTTP development does not. This setup does not provide direct cross-site cookie support.

Matching emails automatically link to one user only when the existing user's email and the incoming provider's email are both verified. An unverified password account must first authenticate using its original method and then explicitly link a verified provider through Better Auth's `/api/auth/link-social` flow. Different-email account linking is disabled. Email verification delivery and password recovery are not configured yet.

Protected routes use `createRequireAuth(auth)` from `apps/server/src/middleware/auth.ts`. It validates the session, populates typed `res.locals.user` and `res.locals.session`, and forwards refreshed or cleared cookies. `GET /api/me` returns `{ "user": ... }` or `401` with `{ "error": "Unauthorized" }`; it does not expose the session token and is not cacheable.

### Email/password smoke test

With the server running and its schema applied, use a cookie jar to carry the session between requests:

```sh
curl -i -c /tmp/do-better-cookies.txt \
  -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
  -d '{"name":"Demo User","email":"demo@example.com","password":"a-long-demo-password"}' \
  http://localhost:3000/api/auth/sign-up/email

curl -i -b /tmp/do-better-cookies.txt -c /tmp/do-better-cookies.txt \
  -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"a-long-demo-password"}' \
  http://localhost:3000/api/auth/sign-in/email

curl -i -b /tmp/do-better-cookies.txt -c /tmp/do-better-cookies.txt \
  http://localhost:3000/api/auth/get-session

curl -i -b /tmp/do-better-cookies.txt -c /tmp/do-better-cookies.txt \
  http://localhost:3000/api/me

curl -i -b /tmp/do-better-cookies.txt -c /tmp/do-better-cookies.txt \
  -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
  -d '{}' http://localhost:3000/api/auth/sign-out

# This now returns 401.
curl -i -b /tmp/do-better-cookies.txt http://localhost:3000/api/me
```

### Automated checks

Engine checks run without a database or network access:

```sh
bun run --cwd apps/cli test:engine
```

Session and result-upload checks use a dedicated database inside the existing `do-better` PostgreSQL container. From the repository root:

```sh
docker exec do-better createdb -U postgres do_better_test
export TEST_DATABASE_URL='postgresql://postgres:password@localhost:5432/do_better_test'
DATABASE_URL="$TEST_DATABASE_URL" bun run --cwd packages/db db:push
bun run --cwd apps/server test:auth
bun run --cwd apps/server test:results
docker exec do-better dropdb -U postgres do_better_test
```

Use `TEST_DATABASE_URL` only for a dedicated test database, not the `do-better` application database. The integration checks use real HTTP endpoints and PostgreSQL to verify sessions, refresh, logout, project ownership, metrics storage, failed writes, and concurrent upload retries. They clean up their generated records. Real OAuth credentials and application environment files are not needed; Google/GitHub callback flows are not covered by these checks.

Live OAuth smoke tests remain a separate step: configure real credentials, start the backend, complete each provider's browser flow, verify `/api/me`, then log out and verify `401`.

## Local test runs and master storage

### Launching the local UI server

The CLI registers `do-better start` as its package executable. It binds to `127.0.0.1`, serves a placeholder UI,
and opens its URL in the default browser. Stop it with Ctrl+C. The React UI screens
are implemented separately in `apps/cli/ui`; serving that build from the CLI and
connecting the request execution/upload endpoints are still pending.

Until npm installation/publishing is set up, launch from the repository root with:

```sh
node apps/cli/src/index.ts start
```

`bun run --cwd apps/cli build` compiles the launch command to
`apps/cli/dist/index.js` for the package executable. Global installation and npm
publishing remain deferred.

The CLI requires Node.js 22.18 or newer. It reads optional
`do-better.config.json` from the directory where the command is run:

```json
{ "port": 4310 }
```

With no file or port setting, the default is `4310`. There is no command-line port
option. Invalid configuration or an occupied port fails with a clear error; the
CLI does not silently choose another port. If browser opening fails, use the URL
printed in the terminal.

Run CLI and engine checks with `bun run --cwd apps/cli test`.

Run `bun run --cwd apps/cli/ui dev` to preview the Stitch-based landing page,
overview, playground, history, results, and settings. The UI supports light/dark
themes and uses labeled sample results until the runner and master are connected.
See [the UI README](apps/cli/ui/README.md) for verification and module details.

`runEngine(params)` in `apps/cli/src/engine.ts` executes POST requests to the configured target and returns an `EngineResult`. The CLI folder owns the engine, configuration/result schemas, scheduling helpers, and engine tests. The master imports the schemas for upload validation and handles authentication and database operations; it does not execute requests against the submitted URL. The launch command and local UI server are implemented; connecting the React UI and local request execution/upload endpoints is pending.

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

Use the existing engine parameters as `params`, omitting `requestData`, and the returned `EngineResult` as `result`. The server strips unrecognized fields, checks project ownership, normalizes duration to seconds and rate to requests per second, and stores only the validated result. No `userId` supplied by the client is trusted.

The engine-generated result ID also identifies the database record. A first upload returns `201`; an identical retry returns the existing record with `200`. Reusing an ID for different data returns `409`. If an upload fails, keep the local result and retry uploading it rather than rerunning the target test.

The application schema adds nullable target URL and JSON result columns for compatibility with older records, permits fractional request rates, and leaves the unused legacy `maxRequests` value nullable. `reqHandled` records completed requests. Apply the schema from `packages/db` with `bun run db:push` after configuring the application database connection.
