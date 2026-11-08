# Local UI

React + TypeScript UI implemented from the Stitch exports in
`stitch_do_better_api_load_tester`. It uses Vite, TanStack Router, TanStack Query,
Tailwind CSS, and shadcn/ui as a nested Bun workspace.

From the repository root:

```sh
bun run --cwd apps/cli/ui dev
bun run --cwd apps/cli/ui check-types
bun run --cwd apps/cli/ui test
bun run --cwd apps/cli/ui build
```

The dev command uses port 5174 for the local UI preview. Use `do-better start` for the integrated runner and account flow. The public website is in `apps/web`. `build` writes static assets to
`apps/cli/ui/dist`. From the repository root, `bun run build:cli` builds the UI
and then the CLI, so `do-better start` serves this build. The CLI returns a clear
error if the build is missing.

Routes are defined in `src/router.tsx`; `src/main.tsx` provides the Query client.
Shared components live in `src/components/ui`, with theme tokens in
`src/styles.css` and shadcn configuration in `components.json`.

Routes: `/` and `/sign-in` (account access), `/overview`, `/playground`, `/history`,
`/runs/:runId`, and `/settings`. Both light and dark themes are available.
The Settings design follows the exported design system because no Settings
screen was included in the export.

`src/components/layout` owns shared navigation/branding; `src/features` groups
request editing, report components, and appearance by domain.
Page components compose these modules. Styles are split by screen/domain under
`src/styles`. Fonts are self-hosted under `public/fonts`, with their OFL licenses.

The Playground executes runs through the local runner and opens each result at
`/runs/:id`; recent runs stay in the CLI server's memory for this session.
Filtering, pagination, JSON downloads, theme preferences, configuration validation,
header editing, and loading run configurations work locally. Drafts and target
secrets stay in memory. Only the theme is stored in localStorage. The CLI opens account creation and sign-in
with the owner username/password after first-time setup; the header shows the account state and
completed runs save to the master automatically. Results show whether a run was
saved and offer a retry; Settings lists pending uploads.

Overview and History load the signed-in account's saved runs through the CLI.
History filtering, sorting, and pagination run on the master API, and exporting
downloads the current page. All workspace pages require sign-in. Signed-out visitors are returned to the sign-in screen.
Run results use CLI memory first and then fetch saved runs from the master. The
`sample-runs` fixture is no longer rendered.

The exports are design references, not an API specification. Unsupported generated
claims (Homebrew installation, p95/p99, time-series data, encrypted SQLite export,
and zero telemetry) are intentionally omitted.

The UI sends API-call configuration to the CLI's local HTTP runner, which invokes
the existing engine and returns results. Target requests execute locally. The CLI
holds the master session and uploads completed runs; the browser never receives
the session cookie. Authentication and database storage belong to the master
server.
