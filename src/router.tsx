import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { AppLayout } from "./AppLayout";
import { DocsRoutePage } from "./docs/DocsRoutePage";
import { GettingStartedPage } from "./GettingStartedPage";
import { ExamplesIndexPage } from "./examples/ExamplesIndexPage";
import { ExampleTopicPage } from "./examples/ExampleTopicPage";
import { PlaygroundExample } from "./examples/playground/PlaygroundExample";

const rootRoute = createRootRoute({ component: AppLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: GettingStartedPage,
});

export const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/$docId",
  component: DocsRoutePage,
});

export const playgroundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/playground",
  component: PlaygroundExample,
});

export const examplesIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/examples",
  component: ExamplesIndexPage,
});

export const exampleTopicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/examples/$topicId",
  component: ExampleTopicPage,
});

/**
 * The routes the site shipped with before the examples became a tree. Kept as
 * redirects because they are in the README, the changelog and anything anyone
 * has already linked.
 */
const legacyTopicRoutes = [
  { path: "/editable-grid", topicId: "cell-editing" },
  { path: "/infinite-scroll", topicId: "infinite-scroll" },
] as const;

/**
 * Example topics that have become documentation pages, where the demo now
 * stands beside the prose explaining it rather than on a route of its own.
 * The static path outranks `/examples/$topicId`, so these win.
 */
const migratedTopicRoutes = [
  { path: "/examples/grouping", docId: "grouping" },
  { path: "/examples/row-selection", docId: "row-selection" },
  { path: "/examples/row-details", docId: "row-details" },
  { path: "/examples/row-pinning", docId: "row-pinning" },
  // Its two demos split: row styling kept the id, clicks and context menus
  // became a page of its own, which the styling page links to.
  { path: "/examples/row-styling", docId: "row-styling" },
  { path: "/examples/sorting", docId: "sorting" },
  // Filtering and its controls were two topics; one page holds both.
  { path: "/examples/filtering", docId: "filtering" },
  { path: "/examples/filter-controls", docId: "filtering" },
  { path: "/examples/column-layout", docId: "column-layout" },
  { path: "/examples/column-definitions", docId: "columns" },
] as const;

const redirectRoutes = [
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/data-grid",
    beforeLoad: () => {
      throw redirect({ to: "/playground", replace: true });
    },
  }),
  // Getting started moved to the front page. The static path outranks
  // `/docs/$docId`, so existing links land on "/" instead of a 404-ish
  // "no page named" message.
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/docs/getting-started",
    beforeLoad: () => {
      throw redirect({ to: "/", replace: true });
    },
  }),
  ...legacyTopicRoutes.map(({ path, topicId }) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      beforeLoad: () => {
        throw redirect({
          to: "/examples/$topicId",
          params: { topicId },
          replace: true,
        });
      },
    }),
  ),
  ...migratedTopicRoutes.map(({ path, docId }) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      beforeLoad: () => {
        throw redirect({
          to: "/docs/$docId",
          params: { docId },
          replace: true,
        });
      },
    }),
  ),
];

const routeTree = rootRoute.addChildren([
  indexRoute,
  docsRoute,
  playgroundRoute,
  examplesIndexRoute,
  exampleTopicRoute,
  ...redirectRoutes,
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
