import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Tests run without the React Compiler that `vite.config.ts` and
 * `vite.lib.config.ts` enable. The compiler's memoization is what several of
 * the grid's subscription comments are about, so a component test here proves
 * the wiring, not the caching behaviour under a production build.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // The deploy scripts are plain ESM run by the workflow, not part of a
    // build, so their tests sit beside them rather than under src/.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    restoreMocks: true,
  },
});
