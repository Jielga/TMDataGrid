import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { AppLayout } from "./AppLayout";
import { DocsRoutePage } from "./docs/DocsRoutePage";
import { ExamplesIndexPage } from "./examples/ExamplesIndexPage";
import { ExampleTopicPage } from "./examples/ExampleTopicPage";
import { PlaygroundExample } from "./examples/playground/PlaygroundExample";

const rootRoute = createRootRoute({ component: AppLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/playground", replace: true });
  },
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

const redirectRoutes = [
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/data-grid",
    beforeLoad: () => {
      throw redirect({ to: "/playground", replace: true });
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
