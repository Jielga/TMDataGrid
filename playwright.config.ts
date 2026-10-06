import { defineConfig, devices } from "@playwright/test";

const DOCS_PORT = 5273;
const DOCS_URL = `http://localhost:${DOCS_PORT}`;
// Must match `server.port` in packages/tmdatagrid/test/gallery/vite.config.ts.
const GALLERY_PORT = 5274;
const GALLERY_URL = `http://localhost:${GALLERY_PORT}/`;

// A default export, because the Playwright runner requires one.
export default defineConfig({
  testDir: "playwright",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    trace: "on-first-retry",
  },
  // Each project is paired with the server its baseURL points at.
  projects: [
    {
      name: "docs",
      testDir: "playwright/docs",
      use: { baseURL: DOCS_URL },
    },
    {
      // Stories from packages/tmdatagrid/test/stories, mounted into the
      // gallery page through Playwright's `mount` fixture.
      name: "components",
      testDir: "playwright/components",
      use: {
        baseURL: GALLERY_URL,
        serviceWorkers: "block",
        permissions: ["clipboard-read", "clipboard-write"],
        // Every `mount` navigates to the gallery afresh, so one context per
        // worker loses no isolation the stories rely on.
        reuseContext: true,
      },
    },
  ],
  // Playwright starts every entry on every run, whatever `--project` says;
  // the gallery is up in about a second, so both always start.
  webServer: [
    {
      // Its own port, so a `bun run dev` on 5173 is never mistaken for the
      // test server; --strictPort makes a taken port fail the run instead of
      // letting Vite drift to the next free one.
      command: `bun run --cwd apps/docs dev --port ${DOCS_PORT} --strictPort`,
      url: `${DOCS_URL}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun run --cwd packages/tmdatagrid gallery",
      url: GALLERY_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
