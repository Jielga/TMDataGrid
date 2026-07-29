import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { AppLayout } from "./AppLayout";
import { DocsRoutePage } from "./docs/DocsRoutePage";
import { DataGridExample } from "./examples/DataGridExample";

const rootRoute = createRootRoute({ component: AppLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/data-grid", replace: true });
  },
});

export const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/$docId",
  component: DocsRoutePage,
});

export const dataGridRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/data-grid",
  component: DataGridExample,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  docsRoute,
  dataGridRoute,
]);

export const router = createRouter({
  routeTree,
  history: createBrowserHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
