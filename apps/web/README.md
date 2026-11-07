# Do Better website

Public product website for Do Better. Built with React, TypeScript, and Vite.
The website introduces the CLI and links to installation and documentation.
The local testing workspace is maintained in `apps/cli/ui`.

## Local development

From the repository root, run `bun dev` to start the website and backend together.
The website uses `http://127.0.0.1:5155`. Launch the local testing workspace
separately with `do-better start`.

To run just the website, use `bun run --cwd apps/web dev`.

## Build and deploy

From the repository root, run:

```sh
bun run --cwd apps/web check-types
bun run build:web
```

Deploy `apps/web/dist` as a static website. Configure your hosting provider to
install dependencies from the repository root using the Bun lockfile and to run
`bun run build:web`. The website needs no backend environment variables.

For a local production preview, run `bun run --cwd apps/web preview`.
