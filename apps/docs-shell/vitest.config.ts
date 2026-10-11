import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/** The shell's own tests: the registry, the header, and the deploy shims. */
export default defineConfig({
  plugins: [react()],
  test: {
    name: "docs-shell",
    environment: "jsdom",
    setupFiles: ["../../vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
