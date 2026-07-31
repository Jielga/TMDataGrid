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
import { InfiniteScrollExample } from "./examples/InfiniteScrollExample";

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

export const infiniteScrollRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/infinite-scroll",
  component: InfiniteScrollExample,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  docsRoute,
  dataGridRoute,
  infiniteScrollRoute,
]);

export const router = createRouter({
  routeTree,
  history: createBrowserHistory(),
  // "/" in dev; "/TMDataGrid/" on GitHub Pages (set via vite --base).
  basepath: import.meta.env.BASE_URL,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
