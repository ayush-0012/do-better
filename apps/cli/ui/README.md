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

The dev command prints the local Vite URL. `build` writes static assets to
`apps/cli/ui/dist`. The CLI runner still serves its original placeholder;
serving this React build through `do-better start` is a separate integration step.

Routes are defined in `src/router.tsx`; `src/main.tsx` provides the Query client.
Shared components live in `src/components/ui`, with theme tokens in
`src/styles.css` and shadcn configuration in `components.json`.

Routes: `/` (landing), `/overview`, `/playground`, `/history`,
`/runs/:runId`, and `/settings`. Both light and dark themes are available.
The Settings design follows the exported design system because no Settings
screen was included in the export.

`src/components/layout` owns shared navigation/branding; `src/features` groups
request editing, report components, appearance, and landing previews by domain.
Page components compose these modules. Styles are split by screen/domain under
`src/styles`. Fonts are self-hosted under `public/fonts`, with their OFL licenses.

The UI currently uses explicitly labeled sample reports. Filtering, pagination,
JSON downloads, theme preferences, configuration validation, header editing, and
loading run configurations work locally. Run test validates configuration and
explains that execution is not connected; it never sends target requests.
Drafts and target secrets stay in memory. Only the theme is stored in localStorage.
Auth, master uploads, runner status, and serving this build from the CLI are pending.

The exports are design references, not an API specification. Unsupported generated
claims (Homebrew installation, p95/p99, time-series data, encrypted SQLite export,
and zero telemetry) are intentionally omitted.

The UI will send API-call configuration to the CLI's local HTTP runner. The runner
will invoke the existing engine and return its results to the UI. Target requests
execute locally; authentication and database storage belong to the master server.
