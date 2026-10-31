import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";
import { Home } from "@/pages/home";
import { AppShell } from "@/components/layout/app-shell";
import { OverviewPage } from "@/pages/overview";
import { PlaygroundPage } from "@/pages/playground";
import { HistoryPage } from "@/pages/history";
import { RunResultsPage } from "@/pages/run-results";
import { SettingsPage } from "@/pages/settings";

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <main className="mx-auto max-w-xl space-y-4 px-6 py-24">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="underline underline-offset-4">Back to home</Link>
    </main>
  ),
});

const shellRoute = createRoute({ getParentRoute: () => rootRoute, id: "workspace", component: AppShell });
const homeRoute = createRoute({ getParentRoute: () => shellRoute, path: "/", component: Home });
const overviewRoute = createRoute({ getParentRoute: () => shellRoute, path: "/overview", component: OverviewPage });
const playgroundRoute = createRoute({ getParentRoute: () => shellRoute, path: "/playground", component: PlaygroundPage });
const historyRoute = createRoute({ getParentRoute: () => shellRoute, path: "/history", component: HistoryPage });
const settingsRoute = createRoute({ getParentRoute: () => shellRoute, path: "/settings", component: SettingsPage });
const resultsRoute = createRoute({ getParentRoute: () => shellRoute, path: "/runs/$runId", component: RunResultsRoute });

function RunResultsRoute() {
  const { runId } = resultsRoute.useParams();
  return <RunResultsPage runId={runId} />;
}

export const router = createRouter({ routeTree: rootRoute.addChildren([shellRoute.addChildren([
  homeRoute, overviewRoute, playgroundRoute, historyRoute, settingsRoute, resultsRoute,
])]), scrollRestoration: true, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
